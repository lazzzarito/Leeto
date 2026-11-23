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

interface HtmlRange {
  start: number;
  end: number;
}

interface ExtractedElement extends HtmlRange {
  tag: string;
  attributes: string;
  inner: string;
}

/** Busca etiquetas por marcado y devuelve su rango junto al contenido interior. */
function extractElements(
  html: string,
  tags: string[],
  predicate: (attributes: string, tag: string) => boolean,
): ExtractedElement[] {
  const found: ExtractedElement[] = [];
  const openings = new RegExp(`<\\s*(${tags.join('|')})\\b([^>]*)>`, 'gi');
  let open: RegExpExecArray | null;

  while ((open = openings.exec(html))) {
    const tag = open[1]!.toLowerCase();
    const attributes = open[2] ?? '';
    if (/\/\s*>$/.test(attributes) || !predicate(attributes, tag)) continue;

    const scanner = new RegExp(`<\\s*(\\/?)\\s*${tag}\\b([^>]*)>`, 'gi');
    scanner.lastIndex = open.index + open[0].length;
    let depth = 1;
    let innerEnd: number | undefined;
    let token: RegExpExecArray | null;

    while (depth > 0 && (token = scanner.exec(html))) {
      if (token[1] === '/') {
        depth -= 1;
        if (depth === 0) innerEnd = token.index;
      } else if (!/\/\s*>$/.test(token[2] ?? '')) {
        depth += 1;
      }
    }
    if (innerEnd === undefined) continue;

    found.push({
      start: open.index,
      end: scanner.lastIndex,
      tag,
      attributes,
      inner: html.slice(open.index + open[0].length, innerEnd),
    });
  }

  // Los contenedores anidados ya están incluidos en el padre.
  return found.filter(
    (element, index) =>
      !found.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          other.start <= element.start &&
          other.end >= element.end &&
          (other.start < element.start || other.end > element.end),
      ),
  );
}

function removeRanges(html: string, ranges: HtmlRange[]): string {
  let result = html;
  for (const range of [...ranges].sort((a, b) => b.start - a.start)) {
    if (range.start >= 0 && range.end > range.start) {
      result = result.slice(0, range.start) + result.slice(range.end);
    }
  }
  return result;
}

function hasClass(attributes: string, names: RegExp): boolean {
  const value = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes);
  return names.test(value?.[1] ?? value?.[2] ?? value?.[3] ?? '');
}

function isFootnoteContainer(attributes: string, tag: string): boolean {
  if (/\b(?:noteref|footnote-ref|footnote-reference|fn-ref)\b/i.test(attributes)) return false;
  const semantic =
    /(?:epub:type|role)\s*=\s*["'][^"']*\b(?:footnote|endnote|doc-footnote)\b[^"']*["']/i.test(
      attributes,
    );
  const cssClass = hasClass(attributes, /\b(?:footnotes?|endnotes?|notebody|note-body)\b/i);
  const genericNote = tag !== 'span' && hasClass(attributes, /\bnote\b/i);
  return semantic || cssClass || genericNote;
}

function isNoteRef(attributes: string): boolean {
  return (
    /(?:epub:type|role)\s*=\s*["'][^"']*\b(?:noteref|doc-noteref)\b[^"']*["']/i.test(attributes) ||
    hasClass(attributes, /\b(?:noteref|footnote-ref|footnote-reference|fn-ref)\b/i)
  );
}

function isPageNumber(attributes: string): boolean {
  return (
    /(?:epub:type|role)\s*=\s*["'][^"']*\bpagebreak\b[^"']*["']/i.test(attributes) ||
    hasClass(attributes, /\b(?:pagenum|page-number|pagebreak|pagination|folio)\b/i)
  );
}

export interface HtmlBlocksResult {
  blocks: LeetoBlock[];
  notes: LeetoBlock[];
}

/**
 * Normaliza HTML a bloques Leeto preservando el orden de texto e imágenes.
 * Las notas al pie se devuelven aparte para colocarlas al final del capítulo.
 * `resolveAsset` traduce la ruta del documento a un assetId ya extraído.
 */
export function htmlToBlocksWithNotes(
  html: string,
  resolveAsset: (src: string) => string | undefined,
  nextId: () => string,
): HtmlBlocksResult {
  const definitions = extractElements(
    html,
    ['aside', 'div', 'section', 'p', 'span', 'li'],
    isFootnoteContainer,
  );
  let cleaned = removeRanges(
    html,
    definitions.map(({ start, end }) => ({ start, end })),
  );

  const refLabels = new Map<string, string>();
  cleaned = cleaned.replace(
    /<\s*a\b([^>]*)>([\s\S]*?)<\s*\/\s*a\s*>/gi,
    (full, attributes: string, inner: string) => {
      if (!isNoteRef(attributes)) return full;
      const label = htmlToPlainText(inner).trim();
      const href = readAttribute(attributes, 'href');
      if (href?.startsWith('#')) {
        refLabels.set(decodeURIComponent(href.slice(1)).trim(), label);
      }
      return '';
    },
  );

  // `<sup>` es marcado, no un dígito suelto: solo se quitan referencias cortas.
  cleaned = cleaned.replace(
    /<\s*sup\b([^>]*)>([\s\S]*?)<\s*\/\s*sup\s*>/gi,
    (full, _attributes: string, inner: string) => {
      const label = htmlToPlainText(inner).trim();
      return label.length <= 5 && /^[\d*†‡§ivxlcdm]+$/i.test(label) ? '' : full;
    },
  );

  const pageNumbers = extractElements(
    cleaned,
    ['span', 'p', 'div', 'a', 'b', 'i'],
    (attributes) => isPageNumber(attributes),
  );
  cleaned = removeRanges(
    cleaned,
    pageNumbers.map(({ start, end }) => ({ start, end })),
  );

  const blocks = blocksFromHtml(cleaned, resolveAsset, nextId);
  const notes: LeetoBlock[] = [];

  definitions.forEach((definition, index) => {
    const text = htmlToPlainText(definition.inner).replace(/\s+/g, ' ').trim();
    if (!text) return;
    const id = readAttribute(definition.attributes, 'id');
    const label = id ? refLabels.get(id) : undefined;
    const content = /^\d+[.)]\s/.test(text) ? text : `${label ?? index + 1}. ${text}`;
    notes.push({
      id: nextId(),
      type: 'text',
      content,
      wordCount: countWords(content),
    });
  });

  return { blocks, notes };
}

/** Versión sin notas, para los formatos que no las separan del cuerpo. */
export function htmlToBlocks(
  html: string,
  resolveAsset: (src: string) => string | undefined,
  nextId: () => string,
): LeetoBlock[] {
  return htmlToBlocksWithNotes(html, resolveAsset, nextId).blocks;
}

function blocksFromHtml(
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

  // Los encabezados se marcan antes de convertir a texto para conservar su naturaleza.
  const withHeadings = marked.replace(
    /<\s*(h[1-6])\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi,
    (_match, _tag: string, inner: string) => `\u0001${inner}\u0003\n`,
  );

  const text = htmlToPlainText(withHeadings);
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
      const heading = content.includes('\u0001');
      const clean = content.replace(/[\u0001\u0003]/g, '').trim();
      if (!clean) continue;
      blocks.push({
        id: nextId(),
        type: 'text',
        content: clean,
        wordCount: countWords(clean),
        ...(heading ? { heading: true } : {}),
      });
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
    case 'bmp':
      return 'image/bmp';
    case 'avif':
      return 'image/avif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}
