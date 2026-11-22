/** Parser de libros de texto plano, Markdown y HTML suelto. */

import { decodeEntities, htmlToBlocks, makeBlockIdFactory } from './normalize';
import { ParseError, type ParseProgress, type ParseRequest, type ParseResult } from './types';

const MAX_TEXT_BYTES = 20 * 1024 * 1024;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Quita la sintaxis Markdown más común sin añadir dependencias. */
function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1');
}

function textToHtml(text: string, headings: boolean): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) paragraphs.push(`<p>${current.join(' ')}</p>`);
    current = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const heading = headings ? /^(#{1,6})\s+(.*)$/.exec(trimmed) : undefined;
    if (heading) {
      flush();
      const level = heading[1]?.length ?? 1;
      paragraphs.push(`<h${level}>${inlineMarkdown(heading[2] ?? '')}</h${level}>`);
      continue;
    }
    current.push(headings ? inlineMarkdown(trimmed) : escapeHtml(trimmed));
  }
  flush();
  return paragraphs.join('\n');
}

function titleFromFileName(fileName: string): string {
  const base = fileName
    .replace(/^\.+/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!base) return 'Sin título';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function parseText(
  request: ParseRequest,
  onProgress: (progress: ParseProgress) => void,
): ParseResult {
  const { bytes, mimeType, fileName } = request;
  if (bytes.byteLength > MAX_TEXT_BYTES) {
    throw new ParseError('El archivo de texto es demasiado grande (máximo 20 MB).', 'UNKNOWN');
  }

  onProgress({ stage: 'parsing', percent: 20 });
  let raw = new TextDecoder('utf-8').decode(bytes);
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  let html: string;
  let title: string;
  if (mimeType === 'text/html') {
    html = raw;
    title = decodeEntities(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1] ?? '').trim();
  } else {
    const markdown = mimeType === 'text/markdown';
    html = textToHtml(raw, markdown);
    title = markdown
      ? decodeEntities(/^#\s+(.+)$/m.exec(raw)?.[1] ?? '')
          .replace(/[*_`]/g, '')
          .trim()
      : '';
  }

  onProgress({ stage: 'normalizing', percent: 80 });
  const nextId = makeBlockIdFactory();
  let blocks = htmlToBlocks(html, () => undefined, nextId);
  // El H1 que da título al libro no debe repetirse como entrada del índice.
  if (title && blocks[0]?.type === 'text' && blocks[0].heading && blocks[0].content === title) {
    blocks = blocks.slice(1);
  }
  if (blocks.length === 0) {
    throw new ParseError('El archivo no contiene texto legible.', 'INVALID_FORMAT');
  }

  const chapterTitle = title || titleFromFileName(fileName);
  const totalWordCount = blocks.reduce((sum, block) => sum + (block.type === 'text' ? block.wordCount : 0), 0);
  onProgress({ stage: 'done', percent: 100 });

  return {
    contentHash: request.contentHash,
    title: chapterTitle,
    author: '',
    fileName,
    fileSize: request.fileSize,
    mimeType,
    chapters: [{ index: 0, title: chapterTitle, blocks }],
    assets: [],
    totalWordCount,
  };
}
