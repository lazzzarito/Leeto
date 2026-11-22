/** Formatos de libro soportados y detección por extensión/MIME. */

export const EPUB_MIME = 'application/epub+zip';
export const PDF_MIME = 'application/pdf';
export const TXT_MIME = 'text/plain';
export const MARKDOWN_MIME = 'text/markdown';
export const HTML_MIME = 'text/html';

export const BOOK_MIMES = [EPUB_MIME, PDF_MIME, TXT_MIME, MARKDOWN_MIME, HTML_MIME];

const EXTENSION_MIME: Record<string, string> = {
  epub: EPUB_MIME,
  pdf: PDF_MIME,
  txt: TXT_MIME,
  text: TXT_MIME,
  md: MARKDOWN_MIME,
  markdown: MARKDOWN_MIME,
  html: HTML_MIME,
  htm: HTML_MIME,
};

const BOOK_EXTENSION = /\.(epub|pdf|txt|text|md|markdown|html|htm)$/i;

export function isBookFile(name: string): boolean {
  return BOOK_EXTENSION.test(name);
}

export function detectMimeType(file: Pick<File, 'name' | 'type'>): string | undefined {
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf('.');
  const extension = dot >= 0 ? name.slice(dot + 1) : '';
  const byExtension = EXTENSION_MIME[extension];
  if (byExtension) return byExtension;
  return BOOK_MIMES.includes(file.type) ? file.type : undefined;
}
