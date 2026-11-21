import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import { newId } from '@/lib/ids';
import {
  extractImageReferences,
  guessMimeType,
  htmlToBlocks,
  makeBlockIdFactory,
  resolveRelativePath,
} from './normalize';
import { ParseError, type ParseProgress, type ParseRequest, type ParseResult } from './types';

interface XmlNode {
  '#text'?: string;
  [key: string]: unknown;
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null;
}

function asNode(value: unknown): XmlNode {
  return isNode(value) ? value : {};
}

function nodeArray(value: unknown): XmlNode[] {
  if (Array.isArray(value)) return value.filter(isNode);
  return isNode(value) ? [value] : [];
}

function textOf(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (isNode(value) && typeof value['#text'] === 'string') return value['#text'].trim();
  return '';
}

function attributeOf(value: unknown, name: string): string {
  const node = asNode(value);
  const attribute = node[`@_${name}`];
  return typeof attribute === 'string' || typeof attribute === 'number'
    ? String(attribute).trim()
    : '';
}

function decodeZipText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function extractHeading(html: string): string {
  const heading = /<\s*h[1-3]\b[^>]*>([\s\S]*?)<\s*\/\s*h[1-3]\s*>/i.exec(html);
  if (heading?.[1]) {
    const text = heading[1]
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) return text;
  }
  const title = /<\s*title\b[^>]*>([\s\S]*?)<\s*\/\s*title\s*>/i.exec(html);
  return title?.[1]?.replace(/<[^>]*>/g, ' ').trim() ?? '';
}

function collectNavPoints(
  value: unknown,
  ncxPath: string,
  output: Map<string, string> = new Map(),
): Map<string, string> {
  for (const point of nodeArray(value)) {
    const label = textOf(asNode(point.navLabel).text);
    const src = attributeOf(point.content, 'src');
    if (label && src) {
      const clean = src.split('#')[0] ?? src;
      output.set(resolveRelativePath(ncxPath, clean), label);
    }
    collectNavPoints(point.navPoint, ncxPath, output);
  }
  return output;
}

export async function parseEpub(
  request: ParseRequest,
  onProgress: (progress: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress({ stage: 'parsing', percent: 5, message: 'Leyendo el contenedor EPUB' });

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(request.bytes);
  } catch {
    throw new ParseError('No se pudo abrir el EPUB; puede estar dañado.', 'INVALID_FORMAT');
  }

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new ParseError('El EPUB no contiene META-INF/container.xml.', 'INVALID_FORMAT');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });

  const container = parser.parse(decodeZipText(await containerFile.async('uint8array')));
  const rootfile = nodeArray(asNode(container.container).rootfiles).flatMap((node) =>
    nodeArray(node.rootfile),
  )[0];
  const opfPath = attributeOf(rootfile, 'full-path');
  if (!opfPath) {
    throw new ParseError('No se encontró el documento OPF del EPUB.', 'INVALID_FORMAT');
  }

  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new ParseError(`Falta el archivo OPF: ${opfPath}`, 'INVALID_FORMAT');
  }

  const opf = parser.parse(decodeZipText(await opfFile.async('uint8array')));
  const packageNode = asNode(opf.package);
  const metadata = asNode(packageNode.metadata);
  const metas = nodeArray(metadata.meta);

  const title = textOf(metadata.title) || request.fileName.replace(/\.epub$/i, '');
  const creators = (Array.isArray(metadata.creator)
    ? metadata.creator
    : [metadata.creator]
  ).map(textOf).filter(Boolean);
  const author = creators.join(', ') || 'Autor desconocido';
  const language = textOf(metadata.language) || undefined;

  const findMeta = (predicate: (node: XmlNode) => boolean): XmlNode | undefined =>
    metas.find(predicate);

  const coverMeta = findMeta((node) => attributeOf(node, 'name') === 'cover');
  const collectionMeta =
    findMeta((node) => attributeOf(node, 'property') === 'belongs-to-collection') ??
    findMeta((node) => attributeOf(node, 'name') === 'calibre:series');
  const volumeMeta =
    findMeta((node) => attributeOf(node, 'property') === 'group-position') ??
    findMeta((node) => attributeOf(node, 'name') === 'calibre:series_index');

  const saga = textOf(collectionMeta) || attributeOf(collectionMeta, 'content') || undefined;
  const volumeText = textOf(volumeMeta) || attributeOf(volumeMeta, 'content');
  const volumeNumber = volumeText ? Number.parseFloat(volumeText) : undefined;

  const manifestItems = nodeArray(asNode(packageNode.manifest).item);
  const manifest = new Map<string, ManifestItem>();
  for (const item of manifestItems) {
    const id = attributeOf(item, 'id');
    const href = attributeOf(item, 'href');
    if (!id || !href) continue;
    manifest.set(id, {
      id,
      href,
      mediaType: attributeOf(item, 'media-type'),
      properties: attributeOf(item, 'properties'),
    });
  }

  const coverItemId = coverMeta ? attributeOf(coverMeta, 'content') : undefined;
  const coverItem =
    (coverItemId ? manifest.get(coverItemId) : undefined) ??
    [...manifest.values()].find((item) => item.properties.split(/\s+/).includes('cover-image'));

  const assets: ParseResult['assets'] = [];
  const pathToAsset = new Map<string, string>();

  const ensureAsset = async (path: string, kind: 'cover' | 'image'): Promise<string | undefined> => {
    const existingId = pathToAsset.get(path);
    if (existingId) {
      if (kind === 'cover') {
        const existing = assets.find((asset) => asset.id === existingId);
        if (existing) existing.kind = 'cover';
      }
      return existingId;
    }
    const file = zip.file(path);
    if (!file) return undefined;
    const bytes = new Uint8Array(await file.async('uint8array'));
    const id = newId('asset');
    assets.push({ id, kind, mimeType: guessMimeType(path), bytes });
    pathToAsset.set(path, id);
    return id;
  };

  const coverPath = coverItem ? resolveRelativePath(opfPath, coverItem.href) : undefined;
  const coverAssetId = coverPath ? await ensureAsset(coverPath, 'cover') : undefined;

  onProgress({ stage: 'parsing', percent: 25, message: 'Leyendo el índice de capítulos' });

  const spine = asNode(packageNode.spine);
  const ncxId = attributeOf(spine, 'toc');
  const ncxItem = ncxId ? manifest.get(ncxId) : undefined;
  let chapterTitles = new Map<string, string>();
  if (ncxItem) {
    const ncxPath = resolveRelativePath(opfPath, ncxItem.href);
    const ncxFile = zip.file(ncxPath);
    if (ncxFile) {
      const ncx = parser.parse(decodeZipText(await ncxFile.async('uint8array')));
      chapterTitles = collectNavPoints(asNode(ncx.ncx).navMap, ncxPath);
    }
  }

  const spineItems = nodeArray(spine.itemref)
    .map((ref) => manifest.get(attributeOf(ref, 'idref')))
    .filter((item): item is ManifestItem => Boolean(item))
    .filter(
      (item) => /xhtml|html/i.test(item.mediaType) || /\.x?html$/i.test(item.href),
    );

  const nextBlockId = makeBlockIdFactory(1);
  const chapters: ParseResult['chapters'] = [];
  let totalWordCount = 0;
  const total = Math.max(1, spineItems.length);

  for (const [index, item] of spineItems.entries()) {
    const documentPath = resolveRelativePath(opfPath, item.href);
    const file = zip.file(documentPath);
    if (!file) continue;

    onProgress({
      stage: 'parsing',
      percent: 25 + Math.round(((index + 1) / total) * 45),
      message: `Procesando ${index + 1} de ${total}`,
    });

    const html = decodeZipText(await file.async('uint8array'));

    onProgress({ stage: 'extracting-assets', percent: 70, message: 'Extrayendo imágenes' });
    for (const reference of extractImageReferences(html)) {
      await ensureAsset(resolveRelativePath(documentPath, reference.src), 'image');
    }

    const blocks = htmlToBlocks(
      html,
      (src) => pathToAsset.get(resolveRelativePath(documentPath, src)),
      nextBlockId,
    );
    totalWordCount += blocks.reduce(
      (sum, block) => sum + (block.type === 'text' ? block.wordCount : 0),
      0,
    );

    const navTitle = chapterTitles.get(documentPath);
    chapters.push({
      index: chapters.length,
      title: navTitle || extractHeading(html) || `Capítulo ${chapters.length + 1}`,
      blocks,
    });
  }

  if (chapters.length === 0) {
    throw new ParseError('El EPUB no contiene capítulos legibles.', 'INVALID_FORMAT');
  }

  onProgress({ stage: 'normalizing', percent: 92, message: 'Normalizando bloques' });

  return {
    contentHash: request.contentHash,
    title,
    author,
    ...(language ? { language } : {}),
    ...(saga ? { saga } : {}),
    ...(typeof volumeNumber === 'number' && Number.isFinite(volumeNumber) ? { volumeNumber } : {}),
    fileName: request.fileName,
    fileSize: request.fileSize,
    mimeType: request.mimeType,
    ...(coverAssetId ? { coverAssetId } : {}),
    chapters,
    assets,
    totalWordCount,
  };
}
