/** Parser de FictionBook 2 (.fb2): metadatos, secciones, portada e imágenes embebidas. */

import { countWords, makeBlockIdFactory } from './normalize';
import { ParseError, type ParseProgress, type ParseRequest, type ParseResult } from './types';

const MAX_FB2_BYTES = 40 * 1024 * 1024;
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const clean = (value?: string | null): string => value?.replace(/\s+/g, ' ').trim() ?? '';

function child(parent: Element | null | undefined, name: string): Element | undefined {
  return parent?.getElementsByTagNameNS('*', name)[0];
}

function directChildren(parent: Element | null | undefined, name: string): Element[] {
  return parent ? Array.from(parent.children).filter((element) => element.localName === name) : [];
}

function hrefOf(image: Element): string {
  return (
    image.getAttribute('l:href') ||
    image.getAttribute('href') ||
    image.getAttributeNS(XLINK_NS, 'href') ||
    ''
  );
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function parseFb2(
  request: ParseRequest,
  onProgress: (progress: ParseProgress) => void,
): ParseResult {
  if (request.bytes.byteLength > MAX_FB2_BYTES) {
    throw new ParseError('El archivo FB2 es demasiado grande (máximo 40 MB).', 'UNKNOWN');
  }

  onProgress({ stage: 'parsing', percent: 15 });
  let xml = new TextDecoder('utf-8').decode(request.bytes);
  if (xml.includes('\uFFFD') && /windows-1251|cp1251/i.test(xml.slice(0, 200))) {
    xml = new TextDecoder('windows-1251').decode(request.bytes);
  }
  if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);

  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new ParseError('No se pudo leer el FB2; puede estar dañado.', 'INVALID_FORMAT');
  }
  const root = document.documentElement;
  if (root.localName !== 'FictionBook') {
    throw new ParseError('El archivo no es un FB2 válido.', 'INVALID_FORMAT');
  }

  const titleInfo = child(child(root, 'description'), 'title-info');
  const authorNode = child(titleInfo, 'author');
  const author = authorNode
    ? clean(
        [
          clean(child(authorNode, 'first-name')?.textContent),
          clean(child(authorNode, 'middle-name')?.textContent),
          clean(child(authorNode, 'last-name')?.textContent),
        ].join(' '),
      )
    : 'Autor desconocido';
  const title = clean(child(titleInfo, 'book-title')?.textContent) ||
    request.fileName.replace(/\.fb2$/i, '');
  const language = clean(child(titleInfo, 'lang')?.textContent) || undefined;
  const coverHref = hrefOf(child(child(titleInfo, 'coverpage'), 'image') ?? document.createElement('image'));

  const assets: ParseResult['assets'] = [];
  let coverAssetId: string | undefined;
  const hrefToAsset = new Map<string, string>();
  onProgress({ stage: 'extracting-assets', percent: 35 });

  for (const binary of Array.from(root.getElementsByTagName('binary'))) {
    const id = binary.getAttribute('id');
    const mimeType = binary.getAttribute('content-type') || 'image/jpeg';
    if (!id || !mimeType.startsWith('image/')) continue;
    const assetId = `asset_${assets.length + 1}`;
    const kind = coverHref === `#${id}` ? 'cover' : 'image';
    assets.push({ id: assetId, kind, mimeType, bytes: decodeBase64(binary.textContent ?? '') });
    hrefToAsset.set(`#${id}`, assetId);
    if (kind === 'cover') coverAssetId = assetId;
  }

  const body = child(root, 'body');
  const sections = directChildren(body, 'section');
  const groups = sections.length > 0 ? sections : body ? [body] : [];
  const nextBlockId = makeBlockIdFactory();
  const chapters: ParseResult['chapters'] = [];
  let totalWordCount = 0;

  for (const [index, section] of groups.entries()) {
    onProgress({
      stage: 'parsing',
      percent: 35 + Math.round(((index + 1) / Math.max(1, groups.length)) * 45),
    });
    const sectionTitle = clean(child(section, 'title')?.textContent) ||
      `Capítulo ${chapters.length + 1}`;
    const blocks: ParseResult['chapters'][number]['blocks'] = [];

    for (const paragraph of directChildren(section, 'p')) {
      const href = child(paragraph, 'image');
      const assetId = href ? hrefToAsset.get(hrefOf(href)) : undefined;
      const content = clean(paragraph.textContent);
      if (content) {
        blocks.push({ id: nextBlockId(), type: 'text', content, wordCount: countWords(content) });
      }
      if (assetId) blocks.push({ id: nextBlockId(), type: 'image', assetId });
    }

    totalWordCount += blocks.reduce(
      (sum, block) => sum + (block.type === 'text' ? block.wordCount : 0),
      0,
    );
    chapters.push({ index: chapters.length, title: sectionTitle, blocks });
  }

  if (chapters.every((chapter) => chapter.blocks.length === 0)) {
    throw new ParseError('El FB2 no contiene texto legible.', 'INVALID_FORMAT');
  }

  onProgress({ stage: 'normalizing', percent: 95 });
  return {
    contentHash: request.contentHash,
    title,
    author,
    language,
    fileName: request.fileName,
    fileSize: request.fileSize,
    mimeType: request.mimeType,
    coverAssetId,
    chapters,
    assets,
    totalWordCount,
  };
}
