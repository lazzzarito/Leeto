import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { LeetoChapter, TocEntry } from '@/types';
import { newId } from '@/lib/ids';
import { countWords, makeBlockIdFactory } from './normalize';
import {
  ParseError,
  type ByteArray,
  type ParseProgress,
  type ParseRequest,
  type ParseResult,
  type RawAsset,
} from './types';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface TextLine {
  y: number;
  height: number;
  text: string;
}

interface Section {
  title: string;
  paragraphs: string[];
  startPage: number;
}

export interface PdfOutlineNode {
  title: string;
  dest?: unknown;
  items?: PdfOutlineNode[];
}

const CHAPTER_PATTERN = /^\s*(cap[ií]tulo|chapter|parte|part)\s+(\d+|[ivxlcdm]+)\b/i;

function isTextItem(item: unknown): item is TextItem {
  return typeof item === 'object' && item !== null && 'str' in item;
}

function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/[\d\s.,;:¡!¿?()\-]/g, '').trim();
}

function collectLines(items: TextItem[]): TextLine[] {
  const lines: TextLine[] = [];
  for (const item of items) {
    const text = item.str;
    if (!text.trim()) continue;
    const y = item.transform[5] ?? 0;
    const height = item.height || 10;
    const line = lines.find((candidate) => Math.abs(candidate.y - y) < Math.max(2, height * 0.4));
    if (line) {
      const gap = (item.transform[4] ?? 0) - line.text.length * height * 0.5;
      line.text += (gap > height * 0.4 ? ' ' : '') + text;
    } else {
      lines.push({ y, height, text });
    }
  }
  return lines.sort((a, b) => b.y - a.y);
}

function linesToParagraphs(lines: TextLine[]): string[] {
  const paragraphs: string[] = [];
  let buffer = '';
  let previous: TextLine | undefined;

  const flush = () => {
    const text = buffer.trim();
    if (text) paragraphs.push(text.replace(/\s+/g, ' '));
    buffer = '';
  };

  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;

    const gap = previous ? previous.y + previous.height - (line.y + line.height) : 0;
    const bigGap = gap > line.height * 1.2;
    const previousEndsSentence = /[.!?…]$/.test(buffer.trim());
    const startsUppercase = /^\p{Lu}/u.test(text);

    if (buffer && (bigGap || (previousEndsSentence && startsUppercase))) flush();
    buffer += (buffer ? ' ' : '') + text;
    previous = line;
  }
  flush();
  return paragraphs;
}

function repeatedMarginals(
  pages: Array<{ lines: TextLine[]; height: number }>,
): Set<string> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const line of page.lines) {
      const relative = line.y / Math.max(1, page.height);
      if (relative > 0.08 && relative < 0.92) continue;
      const key = normalizeForComparison(line.text);
      if (key.length > 2) seen.add(key);
    }
    for (const key of seen) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const threshold = Math.max(2, Math.ceil(pages.length * 0.6));
  return new Set([...counts.entries()].filter(([, count]) => count >= threshold).map(([key]) => key));
}

function stripMarginals(lines: TextLine[], height: number, repeated: Set<string>): TextLine[] {
  return lines.filter((line) => {
    const relative = line.y / Math.max(1, height);
    if (relative > 0.08 && relative < 0.92) return true;
    return !repeated.has(normalizeForComparison(line.text));
  });
}

function buildSections(
  pages: Array<{ lines: TextLine[]; pageNumber: number }>,
  fallbackTitle: string,
): Section[] {
  const sections: Section[] = [];
  let current: Section = { title: fallbackTitle, paragraphs: [], startPage: pages[0]?.pageNumber ?? 1 };

  for (const page of pages) {
    for (const line of page.lines) {
      const heading = CHAPTER_PATTERN.exec(line.text);
      if (heading && line.text.length < 120) {
        if (current.paragraphs.length > 0) sections.push(current);
        current = { title: line.text.trim(), paragraphs: [], startPage: page.pageNumber };
        continue;
      }
    }
    current.paragraphs.push(...linesToParagraphs(page.lines));
  }

  if (current.paragraphs.length > 0 || sections.length === 0) sections.push(current);
  return sections;
}

/** Convierte el outline de PDF en entradas que apuntan a las secciones reales. */
export async function buildPdfToc(
  outline: PdfOutlineNode[],
  resolvePage: (dest: unknown) => Promise<number | undefined>,
  chapters: LeetoChapter[],
): Promise<TocEntry[]> {
  let counter = 0;
  const walk = async (nodes: PdfOutlineNode[]): Promise<TocEntry[]> => {
    const entries: TocEntry[] = [];
    for (const node of nodes) {
      const title = node.title?.trim();
      const children = await walk(node.items ?? []);
      if (!title || !node.dest) {
        entries.push(...children);
        continue;
      }

      const page = await resolvePage(node.dest);
      if (page === undefined) {
        entries.push(...children);
        continue;
      }

      let chapterIndex = 0;
      chapters.forEach((chapter, index) => {
        if ((chapter.startPage ?? 1) <= page) chapterIndex = index;
      });
      const blockId = chapters[chapterIndex]?.blocks[0]?.id;
      counter += 1;
      entries.push({
        id: `toc_pdf_${counter}`,
        title,
        chapterIndex,
        ...(blockId ? { blockId } : {}),
        children,
      });
    }
    return entries;
  };
  return walk(outline);
}

/** Resuelve un destino de outline (nombre o array) a una página 1-based. */
async function resolvePdfPage(
  pdf: PDFDocumentProxy,
  dest: unknown,
): Promise<number | undefined> {
  const toPage = async (target: unknown): Promise<number | undefined> => {
    if (!Array.isArray(target) || !target.length) return undefined;
    const first: unknown = target[0];
    if (typeof first === 'number') return first + 1;
    if (first && typeof first === 'object' && 'num' in first) {
      try {
        return (await pdf.getPageIndex(first as Parameters<PDFDocumentProxy['getPageIndex']>[0])) + 1;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  if (typeof dest === 'string') {
    try {
      const resolved = await pdf.getDestination(dest);
      const page = await toPage(resolved);
      if (page !== undefined) return page;
    } catch {
      // Algunos PDF usan nombres que getDestination no resuelve; se prueba el valor directo.
    }
  }
  return toPage(dest);
}

/** Miniatura de la primera página para que los PDF tengan portada en la biblioteca. */
async function renderPdfCover(pdf: PDFDocumentProxy): Promise<RawAsset | undefined> {
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1, 480 / Math.max(1, base.width)) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const context = canvas.getContext('2d');
    if (!context) {
      page.cleanup();
      return undefined;
    }
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    page.cleanup();
    if (!blob) return undefined;
    return {
      id: newId('asset'),
      kind: 'cover',
      mimeType: 'image/png',
      bytes: new Uint8Array(await blob.arrayBuffer()) as ByteArray,
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    // Sin canvas (tests) o con una página no renderizable: el PDF sigue siendo legible.
    return undefined;
  }
}

export async function parsePdf(
  request: ParseRequest,
  onProgress: (progress: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress({ stage: 'parsing', percent: 5, message: 'Abriendo el PDF' });

  let pdf: PDFDocumentProxy;
  try {
    pdf = await getDocument({ data: request.bytes }).promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo abrir el PDF';
    if (/password|encrypt/i.test(message)) {
      throw new ParseError('Este PDF está protegido con contraseña.', 'ENCRYPTED');
    }
    throw new ParseError(message, 'INVALID_FORMAT');
  }

  try {
    if (pdf.numPages === 0) {
      throw new ParseError('El PDF no contiene páginas.', 'INVALID_FORMAT');
    }

    const pages: Array<{ lines: TextLine[]; height: number }> = [];
    let totalCharacters = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress({
        stage: 'parsing',
        percent: 5 + Math.round(((pageNumber - 1) / pdf.numPages) * 70),
        message: `Leyendo página ${pageNumber} de ${pdf.numPages}`,
      });

      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items.filter(isTextItem);
      const text = items.map((item) => item.str).join('');
      totalCharacters += text.trim().length;
      pages.push({
        lines: collectLines(items),
        height: page.getViewport({ scale: 1 }).height,
      });
      page.cleanup();
    }

    if (totalCharacters / pdf.numPages < 40) {
      throw new ParseError(
        'Este PDF parece escaneado; la versión actual no incluye OCR.',
        'SCANNED_PDF',
      );
    }

    onProgress({ stage: 'extracting-assets', percent: 80, message: 'Depurando cabeceras y pies' });
    const repeated = repeatedMarginals(pages);
    const cleanedPages = pages.map((page, index) => ({
      lines: stripMarginals(page.lines, page.height, repeated),
      pageNumber: index + 1,
    }));

    onProgress({ stage: 'normalizing', percent: 92, message: 'Normalizando bloques' });
    const nextBlockId = makeBlockIdFactory(1);
    const fallbackTitle = request.fileName.replace(/\.pdf$/i, '');
    const sections = buildSections(cleanedPages, fallbackTitle);

    const chapters = sections.map((section, chapterIndex) => ({
      index: chapterIndex,
      title: section.title || fallbackTitle,
      startPage: section.startPage,
      blocks: section.paragraphs
        .filter((content) => content.length > 0)
        .map((content) => ({
          id: nextBlockId(),
          type: 'text' as const,
          content,
          wordCount: countWords(content),
        })),
    }));

    const outline = (await pdf.getOutline().catch(() => undefined)) ?? [];
    const toc = outline.length
      ? await buildPdfToc(
          outline as unknown as PdfOutlineNode[],
          (dest) => resolvePdfPage(pdf, dest),
          chapters,
        )
      : [];

    const totalWordCount = chapters.reduce(
      (sum, chapter) =>
        sum +
        chapter.blocks.reduce(
          (blockSum, block) => blockSum + (block.type === 'text' ? block.wordCount : 0),
          0,
        ),
      0,
    );

    onProgress({ stage: 'extracting-assets', percent: 95, message: 'Creando la portada' });
    const cover = await renderPdfCover(pdf);

    onProgress({ stage: 'done', percent: 100, message: 'Listo' });

    return {
      contentHash: request.contentHash,
      title: fallbackTitle,
      author: 'Autor desconocido',
      fileName: request.fileName,
      fileSize: request.fileSize,
      mimeType: request.mimeType,
      ...(cover ? { coverAssetId: cover.id } : {}),
      chapters,
      ...(toc.length > 0 ? { toc } : {}),
      ...(cover ? { assets: [cover] } : { assets: [] }),
      totalWordCount,
    };
  } finally {
    await pdf.destroy();
  }
}
