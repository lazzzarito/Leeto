/** Parsers de documentos de oficina: DOCX (OOXML) y ODT (ODF). */

import JSZip from 'jszip';
import { newId } from '@/lib/ids';
import type { LeetoChapter } from '@/types';
import { countWords, guessMimeType, makeBlockIdFactory } from './normalize';
import { ParseError, type ParseProgress, type ParseRequest, type ParseResult } from './types';
import { assertZipSafety } from './zipSafety';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const DRAW = 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0';
const XLINK = 'http://www.w3.org/1999/xlink';
const DC = 'http://purl.org/dc/elements/1.1/';

const clean = (value?: string | null): string => value?.replace(/\s+/g, ' ').trim() ?? '';

function parseXml(bytes: Uint8Array, label: string): Document {
  const xml = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new ParseError(`No se pudo leer ${label}.`, 'INVALID_FORMAT');
  }
  return document;
}

function meta(document: Document, name: string): string {
  return clean(document.getElementsByTagNameNS(DC, name)[0]?.textContent);
}

async function addAssetAsync(
  assets: ParseResult['assets'],
  zip: JSZip,
  path: string,
  kind: 'cover' | 'image',
): Promise<string | undefined> {
  const file = zip.file(path);
  if (!file) return undefined;
  const id = newId('asset');
  assets.push({
    id,
    kind,
    mimeType: guessMimeType(path),
    bytes: new Uint8Array(await file.async('uint8array')),
  });
  return id;
}

function finish(
  request: ParseRequest,
  title: string,
  author: string,
  language: string | undefined,
  chapters: LeetoChapter[],
  assets: ParseResult['assets'],
  coverAssetId: string | undefined,
): ParseResult {
  return {
    contentHash: request.contentHash,
    title: title || request.fileName.replace(/\.[^.]+$/, ''),
    author: author || 'Autor desconocido',
    language,
    fileName: request.fileName,
    fileSize: request.fileSize,
    mimeType: request.mimeType,
    coverAssetId,
    chapters,
    assets,
    totalWordCount: chapters.reduce(
      (sum, chapter) =>
        sum +
        chapter.blocks.reduce(
          (blockSum, block) => blockSum + (block.type === 'text' ? block.wordCount : 0),
          0,
        ),
      0,
    ),
  };
}

async function openZip(request: ParseRequest): Promise<{
  zip: JSZip;
  read: (path: string) => Promise<Document>;
}> {
  assertZipSafety(request.bytes);
  try {
    const zip = await JSZip.loadAsync(request.bytes);
    return {
      zip,
      read: async (path: string) => {
        const file = zip.file(path);
        if (!file) throw new ParseError(`Falta ${path} en el documento.`, 'INVALID_FORMAT');
        return parseXml(new Uint8Array(await file.async('uint8array')), path);
      },
    };
  } catch (error) {
    if (error instanceof ParseError) throw error;
    throw new ParseError('No se pudo abrir el documento; puede estar dañado.', 'INVALID_FORMAT');
  }
}

export async function parseDocx(
  request: ParseRequest,
  onProgress: (progress: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress({ stage: 'parsing', percent: 10 });
  const { zip, read } = await openZip(request);
  const document = await read('word/document.xml');
  const core = zip.file('docProps/core.xml')
    ? parseXml(new Uint8Array(await zip.file('docProps/core.xml')!.async('uint8array')), 'core.xml')
    : document;

  let rels = document;
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) rels = parseXml(new Uint8Array(await relsFile.async('uint8array')), 'document.xml.rels');
  const relTargets = new Map<string, string>();
  for (const relation of Array.from(rels.getElementsByTagName('*'))) {
    if (relation.localName !== 'Relationship') continue;
    const id = relation.getAttribute('Id');
    const target = relation.getAttribute('Target');
    if (id && target && !/^https?:/i.test(target)) relTargets.set(id, target.replace(/^\//, ''));
  }

  const assets: ParseResult['assets'] = [];
  const pathToAsset = new Map<string, string>();
  const ensureAsset = async (path: string): Promise<string | undefined> => {
    const normalized = path.replace(/^\.\//, '');
    const existing = pathToAsset.get(normalized);
    if (existing) return existing;
    const id = await addAssetAsync(assets, zip, normalized, 'image');
    if (id) pathToAsset.set(normalized, id);
    return id;
  };

  const thumbnail = ['docProps/thumbnail.jpeg', 'docProps/thumbnail.jpg', 'docProps/thumbnail.png'].find(
    (path) => zip.file(path),
  );
  const coverAssetId = thumbnail ? await addAssetAsync(assets, zip, thumbnail, 'cover') : undefined;

  const paragraphs = Array.from(document.getElementsByTagNameNS(W, 'p'));
  const nextBlockId = makeBlockIdFactory();
  const blocks: LeetoChapter['blocks'] = [];
  for (const [index, paragraph] of paragraphs.entries()) {
    onProgress({
      stage: 'parsing',
      percent: 10 + Math.round(((index + 1) / Math.max(1, paragraphs.length)) * 70),
    });
    const content = clean(
      Array.from(paragraph.getElementsByTagNameNS(W, 't'))
        .map((node) => node.textContent)
        .join(''),
    );
    const style = clean(paragraph.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val'));
    if (content) {
      blocks.push({
        id: nextBlockId(),
        type: 'text',
        content,
        wordCount: countWords(content),
        ...(/^Heading/i.test(style) ? { heading: true } : {}),
      });
    }
    for (const blip of Array.from(paragraph.getElementsByTagNameNS(A, 'blip'))) {
      const embed = blip.getAttributeNS(R, 'embed') || blip.getAttributeNS(R, 'link');
      const target = embed ? relTargets.get(embed) : undefined;
      if (!target) continue;
      const path = target.startsWith('word/') ? target : `word/${target.replace(/^\.\//, '')}`;
      const assetId = await ensureAsset(path);
      if (assetId) blocks.push({ id: nextBlockId(), type: 'image', assetId });
    }
  }

  if (blocks.length === 0) throw new ParseError('El DOCX no contiene texto legible.', 'INVALID_FORMAT');
  onProgress({ stage: 'normalizing', percent: 95 });
  return finish(
    request,
    meta(core, 'title'),
    meta(core, 'creator'),
    meta(core, 'language') || undefined,
    [{ index: 0, title: meta(core, 'title') || 'Documento', blocks }],
    assets,
    coverAssetId,
  );
}

export async function parseOdt(
  request: ParseRequest,
  onProgress: (progress: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress({ stage: 'parsing', percent: 10 });
  const { zip, read } = await openZip(request);
  const content = await read('content.xml');
  const metaFile = zip.file('meta.xml');
  const metadata = metaFile
    ? parseXml(new Uint8Array(await metaFile.async('uint8array')), 'meta.xml')
    : content;

  const assets: ParseResult['assets'] = [];
  const pathToAsset = new Map<string, string>();
  const ensureAsset = async (path: string): Promise<string | undefined> => {
    const existing = pathToAsset.get(path);
    if (existing) return existing;
    const id = await addAssetAsync(assets, zip, path, 'image');
    if (id) pathToAsset.set(path, id);
    return id;
  };

  const thumbnail = ['Thumbnails/thumbnail.png', 'Thumbnails/thumbnail.jpg'].find((path) => zip.file(path));
  const coverAssetId = thumbnail ? await addAssetAsync(assets, zip, thumbnail, 'cover') : undefined;

  const elements = Array.from(content.getElementsByTagName('*')).filter(
    (element) =>
      (element.namespaceURI === OFFICE || element.namespaceURI === TEXT) &&
      (element.localName === 'p' || element.localName === 'h'),
  );
  const nextBlockId = makeBlockIdFactory();
  const blocks: LeetoChapter['blocks'] = [];

  for (const [index, element] of elements.entries()) {
    onProgress({
      stage: 'parsing',
      percent: 10 + Math.round(((index + 1) / Math.max(1, elements.length)) * 70),
    });
    const paragraphText = clean(element.textContent);
    if (paragraphText) {
      blocks.push({
        id: nextBlockId(),
        type: 'text',
        content: paragraphText,
        wordCount: countWords(paragraphText),
        ...(element.localName === 'h' ? { heading: true } : {}),
      });
    }
    for (const image of Array.from(element.getElementsByTagNameNS(DRAW, 'image'))) {
      const href = image.getAttributeNS(XLINK, 'href');
      if (!href) continue;
      const assetId = await ensureAsset(href.replace(/^\.\//, ''));
      if (assetId) blocks.push({ id: nextBlockId(), type: 'image', assetId });
    }
  }

  if (blocks.length === 0) throw new ParseError('El ODT no contiene texto legible.', 'INVALID_FORMAT');
  onProgress({ stage: 'normalizing', percent: 95 });
  return finish(
    request,
    meta(metadata, 'title'),
    meta(metadata, 'creator'),
    meta(metadata, 'language') || undefined,
    [{ index: 0, title: meta(metadata, 'title') || 'Documento', blocks }],
    assets,
    coverAssetId,
  );
}
