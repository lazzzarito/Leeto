import { hashBytes } from '@/lib/hash';
import { ParseError, type ParseProgress, type ParseRequest, type ParseResult } from './types';
import { runParserWorker } from './workerClient';

export const EPUB_MIME = 'application/epub+zip';
export const PDF_MIME = 'application/pdf';

export function detectMimeType(file: File): string | undefined {
  const name = file.name.toLowerCase();
  if (file.type === EPUB_MIME || name.endsWith('.epub')) return EPUB_MIME;
  if (file.type === PDF_MIME || name.endsWith('.pdf')) return PDF_MIME;
  return undefined;
}

/** Hash + parseo, delegando EPUB a su worker y PDF al worker propio de PDF.js. */
export async function parseFile(
  file: File,
  onProgress: (progress: ParseProgress) => void,
  contentHash?: string,
): Promise<ParseResult> {
  const mimeType = detectMimeType(file);
  if (!mimeType) {
    throw new ParseError(
      'Formato no soportado. Leeto admite EPUB y PDF con texto seleccionable.',
      'INVALID_FORMAT',
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const request: ParseRequest = {
    contentHash: contentHash ?? (await hashBytes(bytes)),
    fileName: file.name,
    fileSize: file.size,
    mimeType,
    bytes,
  };

  if (mimeType === EPUB_MIME) return runParserWorker('epub', request, onProgress);

  // PDF.js es pesado: se carga solo cuando se importa un PDF.
  const { parsePdf } = await import('./pdf');
  return parsePdf(request, onProgress);
}

export { ParseError, type ParseProgress, type ParseResult } from './types';
