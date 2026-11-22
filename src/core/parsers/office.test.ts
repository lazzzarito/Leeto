import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { DOCX_MIME, ODT_MIME } from './formats';
import { parseDocx, parseOdt } from './office';
import type { ParseRequest } from './types';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';

function request(bytes: Uint8Array<ArrayBuffer>, mimeType: string, fileName: string): ParseRequest {
  return {
    contentHash: 'sha256:office',
    fileName,
    fileSize: bytes.byteLength,
    mimeType,
    bytes,
  };
}

async function docxFixture(): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    `<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>El bosque</w:t></w:r></w:p>
      <w:p><w:r><w:t>Un párrafo de prueba.</w:t></w:r></w:p>
    </w:body></w:document>`,
  );
  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Mi documento</dc:title><dc:creator>Ana Ruiz</dc:creator><dc:language>es</dc:language></cp:coreProperties>`,
  );
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  );
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
}

async function odtFixture(): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new JSZip();
  zip.file(
    'content.xml',
    `<?xml version="1.0"?><office:document-content xmlns:office="${OFFICE}" xmlns:text="${TEXT}"><office:body><office:text>
      <text:h>Capítulo uno</text:h><text:p>Texto del documento.</text:p>
    </office:text></office:body></office:document-content>`,
  );
  zip.file(
    'meta.xml',
    `<?xml version="1.0"?><office:document-meta xmlns:office="${OFFICE}" xmlns:dc="http://purl.org/dc/elements/1.1/"><office:meta><dc:title>Mi ODT</dc:title><dc:creator>Ana Ruiz</dc:creator><dc:language>es</dc:language></office:meta></office:document-meta>`,
  );
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
}

describe('parseDocx', () => {
  it('extrae metadatos, párrafos y encabezados', async () => {
    const bytes = await docxFixture();
    const result = await parseDocx(request(bytes, DOCX_MIME, 'documento.docx'), () => {});

    expect(result.title).toBe('Mi documento');
    expect(result.author).toBe('Ana Ruiz');
    expect(result.language).toBe('es');
    const blocks = result.chapters[0]?.blocks ?? [];
    expect(blocks.map((block) => (block.type === 'text' ? block.content : ''))).toEqual([
      'El bosque',
      'Un párrafo de prueba.',
    ]);
    expect(blocks[0]).toMatchObject({ heading: true });
  });
});

describe('parseOdt', () => {
  it('extrae metadatos, encabezados y párrafos', async () => {
    const bytes = await odtFixture();
    const result = await parseOdt(request(bytes, ODT_MIME, 'documento.odt'), () => {});

    expect(result.title).toBe('Mi ODT');
    expect(result.author).toBe('Ana Ruiz');
    const blocks = result.chapters[0]?.blocks ?? [];
    expect(blocks[0]).toMatchObject({ content: 'Capítulo uno', heading: true });
    expect(blocks[1]).toMatchObject({ content: 'Texto del documento.' });
  });
});
