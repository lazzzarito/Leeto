import { hashBytes } from '@/lib/hash';
import { detectMimeType, EPUB_MIME, PDF_MIME } from './formats';
import { ParseError, type ParseProgress, type ParseRequest, type ParseResult } from './types';
import { runParserWorker } from './workerClient';

/** Hash + parseo: EPUB en worker, PDF con PDF.js y texto en el hilo principal. */
export async function parseFile(
  file: File,
  onProgress: (progress: ParseProgress) => void,
  contentHash?: string,
): Promise<ParseResult> {
  const mimeType = detectMimeType(file);
  if (!mimeType) {
    throw new ParseError(
      'Formato no soportado. Leeto admite EPUB, PDF con texto y archivos TXT, Markdown y HTML.',
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

  if (mimeType === PDF_MIME) {
    // PDF.js es pesado: se carga solo cuando se importa un PDF.
    const { parsePdf } = await import('./pdf');
    return parsePdf(request, onProgress);
  }

  const { parseText } = await import('./text');
  return parseText(request, onProgress);
}

export {
  detectMimeType,
  EPUB_MIME,
  HTML_MIME,
  MARKDOWN_MIME,
  PDF_MIME,
  TXT_MIME,
} from './formats';
export { ParseError, type ParseProgress, type ParseResult } from './types';
