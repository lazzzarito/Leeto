import JSZip from 'jszip';
import { newId } from '@/lib/ids';
import type { LeetoBlock, TocEntry } from '@/types';
import { PARSE_LIMITS } from './limits';
import {
  decodeEntities,
  extractImageReferences,
  guessMimeType,
  htmlToBlocksWithNotes,
  makeBlockIdFactory,
  resolveRelativePath,
} from './normalize';
import { ParseError, type ParseProgress, type ParseRequest, type ParseResult } from './types';
import { assertZipSafety } from './zipSafety';

import { asNode, attributeOf, makeXmlParser, nodeArray, textOf, type XmlNode } from './xml';

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
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

interface RawNavPoint {
  title: string;
  path: string;
  fragment?: string;
  children: RawNavPoint[];
}

function splitTarget(href: string, basePath: string): Pick<RawNavPoint, 'path' | 'fragment'> | undefined {
  const [rawPath, rawFragment] = href.split('#');
  if (!rawPath) return undefined;
  let fragment: string | undefined;
  if (rawFragment) {
    try {
      fragment = decodeURIComponent(rawFragment);
    } catch {
      fragment = rawFragment;
    }
  }
  return {
    path: resolveRelativePath(basePath, rawPath),
    ...(fragment ? { fragment } : {}),
  };
}

/** navMap NCX: respeta el anidamiento de navPoint. */
function collectNcxPoints(value: unknown, ncxPath: string): RawNavPoint[] {
  return nodeArray(value).flatMap((point) => {
    const title = textOf(asNode(point.navLabel).text);
    const target = splitTarget(attributeOf(point.content, 'src'), ncxPath);
    const children = collectNcxPoints(point.navPoint, ncxPath);
    if (!title || !target) return children;
    return [{ title, ...target, children }];
  });
}

/** EPUB3 nav: recorre `<ol><li><a href>` y sus listas anidadas. */
function collectNavLists(value: unknown, navPath: string): RawNavPoint[] {
  return nodeArray(value).flatMap((list) =>
    nodeArray(list.li).flatMap((item) => {
      const anchor = nodeArray(item.a)[0];
      const title = textOf(anchor ?? item);
      const target = splitTarget(attributeOf(anchor, 'href'), navPath);
      const children = collectNavLists(item.ol, navPath);
      if (!title || !target) return children;
      return [{ title, ...target, children }];
    }),
  );
}

function findTocNavigation(value: unknown): XmlNode | undefined {
  const nodes = nodeArray(value);
  return (
    nodes.find(
      (node) => attributeOf(node, 'type') === 'toc' || attributeOf(node, 'role') === 'doc-toc',
    ) ?? nodes[0]
  );
}

function textInsideElement(html: string, id: string): string {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<[^>]*\\bid\\s*=\\s*(["'])${escaped}\\1[^>]*>([\\s\\S]*?)<\\/\\s*[a-z][\\w:-]*\\s*>`,
    'i',
  );
  const match = pattern.exec(html);
  if (!match?.[2]) return '';
  return decodeEntities(match[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function comparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 80);
}

/** Une el fragmento del TOC con el bloque real generado a partir del XHTML. */
function findAnchorBlockId(
  html: string,
  fragment: string,
  blocks: LeetoBlock[],
): string | undefined {
  const heading = comparable(textInsideElement(html, fragment));
  const first = blocks[0]?.id;
  if (!heading) return first;
  const match = blocks.find(
    (block) => block.type === 'text' && comparable(block.content).includes(heading),
  );
  return match?.id ?? first;
}

function buildTocEntries(
  raw: RawNavPoint[],
  chapterIndexByPath: Map<string, number>,
  chapterHtmlByPath: Map<string, string>,
  chapters: ParseResult['chapters'],
): TocEntry[] {
  let counter = 0;
  const walk = (nodes: RawNavPoint[]): TocEntry[] =>
    nodes.flatMap((node) => {
      const chapterIndex = chapterIndexByPath.get(node.path);
      if (chapterIndex === undefined) return walk(node.children);

      const blocks = chapters[chapterIndex]?.blocks ?? [];
      const blockId = node.fragment
        ? findAnchorBlockId(chapterHtmlByPath.get(node.path) ?? '', node.fragment, blocks)
        : blocks[0]?.id;
      counter += 1;
      return [
        {
          id: `toc_${counter}`,
          title: node.title,
          chapterIndex,
          ...(blockId ? { blockId } : {}),
          children: walk(node.children),
        },
      ];
    });
  return walk(raw);
}

export async function parseEpub(
  request: ParseRequest,
  onProgress: (progress: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress({ stage: 'parsing', percent: 5, message: 'Leyendo el contenedor EPUB' });
  assertZipSafety(request.bytes);

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

  const parser = makeXmlParser();

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
    if (assets.length >= PARSE_LIMITS.maxAssetsPerBook) {
      throw new ParseError('El EPUB contiene demasiadas imágenes para importar.', 'UNKNOWN');
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
  let rawToc: RawNavPoint[] = [];
  if (ncxItem) {
    const ncxPath = resolveRelativePath(opfPath, ncxItem.href);
    const ncxFile = zip.file(ncxPath);
    if (ncxFile) {
      const ncx = parser.parse(decodeZipText(await ncxFile.async('uint8array')));
      rawToc = collectNcxPoints(asNode(ncx.ncx).navMap, ncxPath);
    }
  }
  if (rawToc.length === 0) {
    const navItem = [...manifest.values()].find((item) =>
      item.properties.split(/\s+/).includes('nav'),
    );
    const navPath = navItem ? resolveRelativePath(opfPath, navItem.href) : undefined;
    const navFile = navPath ? zip.file(navPath) : undefined;
    if (navFile) {
      const navDoc = parser.parse(decodeZipText(await navFile.async('uint8array')));
      const body = asNode(asNode(navDoc.html).body);
      const tocNav = findTocNavigation(body);
      rawToc = collectNavLists(asNode(tocNav?.ol), navPath as string);
    }
  }

  const chapterTitles = new Map<string, string>();
  const registerTitles = (nodes: RawNavPoint[]): void => {
    for (const node of nodes) {
      if (!chapterTitles.has(node.path)) chapterTitles.set(node.path, node.title);
      registerTitles(node.children);
    }
  };
  registerTitles(rawToc);
  if (rawToc.length > PARSE_LIMITS.maxTocNodes) {
    throw new ParseError('El EPUB tiene un índice demasiado extenso.', 'UNKNOWN');
  }

  const spineItems = nodeArray(spine.itemref)
    .map((ref) => manifest.get(attributeOf(ref, 'idref')))
    .filter((item): item is ManifestItem => Boolean(item))
    .filter(
      (item) => /xhtml|html/i.test(item.mediaType) || /\.x?html$/i.test(item.href),
    );

  if (spineItems.length > PARSE_LIMITS.maxEpubSpineItems) {
    throw new ParseError('El EPUB tiene demasiados capítulos para importar.', 'UNKNOWN');
  }

  const nextBlockId = makeBlockIdFactory(1);
  const chapters: ParseResult['chapters'] = [];
  const chapterIndexByPath = new Map<string, number>();
  const chapterHtmlByPath = new Map<string, string>();
  let totalWordCount = 0;
  let parsedBlockCount = 0;
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
    if (html.length > PARSE_LIMITS.maxHtmlCharsPerChapter) {
      throw new ParseError('Un capítulo del EPUB es demasiado extenso.', 'UNKNOWN');
    }

    onProgress({ stage: 'extracting-assets', percent: 70, message: 'Extrayendo imágenes' });
    for (const reference of extractImageReferences(html)) {
      await ensureAsset(resolveRelativePath(documentPath, reference.src), 'image');
    }

    const { blocks, notes } = htmlToBlocksWithNotes(
      html,
      (src) => pathToAsset.get(resolveRelativePath(documentPath, src)),
      nextBlockId,
    );
    // Las notas viajan al final del capítulo como bloques de texto normales.
    blocks.push(...notes);
    parsedBlockCount += blocks.length;
    if (parsedBlockCount > PARSE_LIMITS.maxBlocksPerBook) {
      throw new ParseError('El EPUB contiene demasiados bloques para importar.', 'UNKNOWN');
    }
    totalWordCount += blocks.reduce(
      (sum, block) => sum + (block.type === 'text' ? block.wordCount : 0),
      0,
    );

    const navTitle = chapterTitles.get(documentPath);
    chapterIndexByPath.set(documentPath, chapters.length);
    chapterHtmlByPath.set(documentPath, html);
    chapters.push({
      index: chapters.length,
      title: navTitle || extractHeading(html) || `Capítulo ${chapters.length + 1}`,
      blocks,
    });
  }

  if (chapters.length === 0) {
    throw new ParseError('El EPUB no contiene capítulos legibles.', 'INVALID_FORMAT');
  }
  if (chapters.length > PARSE_LIMITS.maxEpubSpineItems) {
    throw new ParseError('El EPUB tiene demasiados capítulos para importar.', 'UNKNOWN');
  }

  onProgress({ stage: 'normalizing', percent: 92, message: 'Normalizando bloques' });
  const toc = buildTocEntries(rawToc, chapterIndexByPath, chapterHtmlByPath, chapters);

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
    ...(toc.length > 0 ? { toc } : {}),
    assets,
    totalWordCount,
  };
}
