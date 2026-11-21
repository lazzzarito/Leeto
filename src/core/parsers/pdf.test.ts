import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { describe, expect, it } from 'vitest';
import { parsePdf } from './pdf';
import type { ParseRequest } from './types';

// En Node, PDF.js no puede resolver la URL `?url` de Vite: usar la ruta real del worker.
GlobalWorkerOptions.workerSrc = pathToFileURL(
  resolve(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
).href;

function escapePdfText(text: string): string {
  return text.replace(/([\\()])/g, '\\$1');
}

/** PDF mínimo de una página con una capa de texto controlada. */
function buildPdfFixture(lines: string[]): Uint8Array<ArrayBuffer> {
  const operators = lines
    .map((line, index) => {
      const move = index === 0 ? '' : '0 -24 Td ';
      return `${move}(${escapePdfText(line)}) Tj `;
    })
    .join('');
  const content = `BT /F1 12 Tf 72 720 Td ${operators}ET`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Uint8Array(new TextEncoder().encode(pdf));
}

function requestFor(bytes: Uint8Array<ArrayBuffer>): ParseRequest {
  return {
    contentHash: 'sha256:pdf-fixture',
    fileName: 'prueba.pdf',
    fileSize: bytes.byteLength,
    mimeType: 'application/pdf',
    bytes,
  };
}

describe('parsePdf', () => {
  it('extrae bloques de texto de un PDF con capa de texto', async () => {
    const bytes = buildPdfFixture([
      'Capítulo 1',
      'Este es un párrafo de prueba con varias palabras para verificar la extracción.',
    ]);
    const result = await parsePdf(requestFor(bytes), () => {});

    expect(result.chapters.length).toBeGreaterThan(0);
    expect(result.totalWordCount).toBeGreaterThan(10);
    expect(result.chapters[0]?.blocks.some((block) => block.type === 'text')).toBe(true);
  });

  it('rechaza un PDF sin capa de texto como escaneado', async () => {
    const bytes = buildPdfFixture([]);
    await expect(parsePdf(requestFor(bytes), () => {})).rejects.toMatchObject({
      code: 'SCANNED_PDF',
    });
  });
});
