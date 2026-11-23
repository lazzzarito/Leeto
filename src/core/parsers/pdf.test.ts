import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { describe, expect, it } from 'vitest';
import { buildPdfToc, parsePdf } from './pdf';
import type { ParseRequest } from './types';
import type { LeetoChapter } from '@/types';

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

/** Igual que la fixture de una página, pero con varias páginas numeradas al pie. */
type FixtureLine = string | { text: string; y: number };

function buildMultiPagePdfFixture(pages: FixtureLine[][]): Uint8Array<ArrayBuffer> {
  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ');
  const fontObject = 3 + pages.length * 2;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
  ];

  pages.forEach((lines, pageIndex) => {
    const contentObject = 4 + pageIndex * 2;
    let baseline = 720;
    const content = lines
      .map((line) => {
        const text = typeof line === 'string' ? line : line.text;
        const y = typeof line === 'string' ? baseline : line.y;
        baseline = y - 24;
        return `BT /F1 12 Tf 72 ${y} Td (${escapePdfText(text)}) Tj ET `;
      })
      .join('');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

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

  it('no repite los encabezados en el cuerpo y separa secciones de la misma página', async () => {
    const bytes = buildPdfFixture([
      'Chapter 1',
      'Texto previo con suficientes palabras para formar un párrafo completo y detectable.',
      'Chapter 2',
      'Texto posterior con suficientes palabras para formar otro párrafo completo y detectable.',
    ]);
    const result = await parsePdf(requestFor(bytes), () => {});

    const textOf = (chapterIndex: number) => {
      const block = result.chapters[chapterIndex]?.blocks[0];
      return block?.type === 'text' ? block.content : '';
    };
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(['Chapter 1', 'Chapter 2']);
    expect(textOf(0)).not.toContain('Chapter');
    expect(textOf(0)).toContain('previo');
    expect(textOf(1)).toContain('posterior');
  });

  it('elimina los números de página que cambian en el pie', async () => {
    const body = 'Texto del contenido con suficientes palabras para formar un párrafo legible.';
    const bytes = buildMultiPagePdfFixture(
      [1, 2, 3].map((n) => [body, { text: String(n), y: 30 }]),
    );
    const result = await parsePdf(requestFor(bytes), () => {});

    const contents = result.chapters.flatMap((chapter) =>
      chapter.blocks.flatMap((block) => (block.type === 'text' ? [block.content] : [])),
    );
    expect(contents.some((content) => /^\d+$/.test(content.trim()))).toBe(false);
    expect(contents.join(' ')).toContain('Texto del contenido');
  });

  it('rechaza un PDF sin capa de texto como escaneado', async () => {
    const bytes = buildPdfFixture([]);
    await expect(parsePdf(requestFor(bytes), () => {})).rejects.toMatchObject({
      code: 'SCANNED_PDF',
    });
  });
});

describe('buildPdfToc', () => {
  it('resuelve un outline anidado a las secciones por página de inicio', async () => {
    const chapters: LeetoChapter[] = [
      {
        index: 0,
        title: 'Capítulo 1',
        startPage: 1,
        blocks: [{ id: 'b_001', type: 'text', content: 'Inicio', wordCount: 1 }],
      },
      {
        index: 1,
        title: 'Capítulo 2',
        startPage: 10,
        blocks: [{ id: 'b_002', type: 'text', content: 'Seguimiento', wordCount: 1 }],
      },
    ];

    const toc = await buildPdfToc(
      [
        {
          title: 'Parte I',
          dest: 'parte',
          items: [{ title: 'Sección', dest: 'seccion' }],
        },
      ],
      async (dest) => (dest === 'parte' ? 2 : 12),
      chapters,
    );

    expect(toc).toHaveLength(1);
    expect(toc[0]).toMatchObject({ title: 'Parte I', chapterIndex: 0, blockId: 'b_001' });
    expect(toc[0]?.children[0]).toMatchObject({
      title: 'Sección',
      chapterIndex: 1,
      blockId: 'b_002',
    });
  });
});
