import type { LeetoBlock } from '@/types';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  aacute: 'á',
  Aacute: 'Á',
  eacute: 'é',
  Eacute: 'É',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  uacute: 'ú',
  Uacute: 'Ú',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  agrave: 'à',
  egrave: 'è',
  igrave: 'ì',
  ograve: 'ò',
  ugrave: 'ù',
  ccedil: 'ç',
  deg: '°',
  bull: '•',
};

function fromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name: string) => NAMED_ENTITIES[name] ?? match);
}

/** Convierte HTML/XHTML tolerante a texto plano, usando saltos por bloque. */
export function htmlToPlainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*(script|style|head)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*\/\s*(p|div|li|h[1-6]|blockquote|tr|section|article)\s*>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n'),
  );
}

export function countWords(text: string): number {
  const words = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return words?.length ?? 0;
}

function readAttribute(tag: string, name: string): string | undefined {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  );
  const match = pattern.exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

export function makeBlockIdFactory(start = 1): () => string {
  let counter = start - 1;
  return () => `b_${String(++counter).padStart(3, '0')}`;
}

export interface ImageReference {
  src: string;
  alt?: string;
}

/** Extrae referencias `<img>` de un documento sin depender del DOM. */
export function extractImageReferences(html: string): ImageReference[] {
  const references: ImageReference[] = [];
  html.replace(/<\s*img\b[^>]*>/gi, (tag) => {
    const src = readAttribute(tag, 'src');
    if (src) references.push({ src, alt: readAttribute(tag, 'alt') });
    return tag;
  });
  return references;
}

/**
 * Normaliza HTML a bloques Leeto preservando el orden de texto e imágenes.
 * `resolveAsset` traduce la ruta del documento a un assetId ya extraído.
 */
export function htmlToBlocks(
  html: string,
  resolveAsset: (src: string) => string | undefined,
  nextId: () => string,
): LeetoBlock[] {
  const images: ImageReference[] = [];
  const marked = html.replace(/<\s*img\b[^>]*>/gi, (tag) => {
    const src = readAttribute(tag, 'src');
    if (!src) return ' ';
    const index = images.length;
    images.push({ src, alt: readAttribute(tag, 'alt') });
    return `\u0000IMG${index}\u0000`;
  });

  const text = htmlToPlainText(marked);
  const parts = text.split(/(\u0000IMG\d+\u0000)/);
  const blocks: LeetoBlock[] = [];

  for (const part of parts) {
    const imageMatch = /^\u0000IMG(\d+)\u0000$/.exec(part.trim());
    if (imageMatch) {
      const reference = images[Number(imageMatch[1])];
      const assetId = reference ? resolveAsset(reference.src) : undefined;
      if (assetId) {
        blocks.push({
          id: nextId(),
          type: 'image',
          assetId,
          ...(reference?.alt ? { alt: reference.alt } : {}),
        });
      }
      continue;
    }

    for (const paragraph of part.split(/\n+/)) {
      const content = paragraph.trim();
      if (!content) continue;
      blocks.push({ id: nextId(), type: 'text', content, wordCount: countWords(content) });
    }
  }

  return blocks;
}

/** Resuelve rutas relativas dentro del ZIP de un EPUB (acepta `../` y `./`). */
export function resolveRelativePath(base: string, relative: string): string {
  let decoded = relative;
  try {
    decoded = decodeURIComponent(relative);
  } catch {
    // Mantener la ruta original si el escape no es válido.
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return decoded;

  const baseDir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '';
  const output: string[] = [];
  for (const segment of `${baseDir}${decoded}`.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      output.pop();
      continue;
    }
    output.push(segment);
  }
  return output.join('/');
}

export function guessMimeType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}
