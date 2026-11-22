import { describe, expect, it } from 'vitest';
import { HTML_MIME, MARKDOWN_MIME, TXT_MIME } from './formats';
import { parseText } from './text';
import { ParseError, type ParseRequest } from './types';

function request(text: string, mimeType: string, fileName = 'libro.txt'): ParseRequest {
  const bytes = new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
  return {
    contentHash: 'sha256:text',
    fileName,
    fileSize: bytes.byteLength,
    mimeType,
    bytes,
  };
}

describe('parseText', () => {
  it('convierte TXT en párrafos y usa el nombre de archivo como título', () => {
    const result = parseText(request('Primera línea.\nSegunda línea.\n\nOtro párrafo.', TXT_MIME), () => {});
    expect(result.title).toBe('Libro');
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]?.blocks.map((block) => block.type)).toEqual(['text', 'text']);
    expect(result.chapters[0]?.blocks[0]).toMatchObject({ content: 'Primera línea. Segunda línea.' });
    expect(result.totalWordCount).toBeGreaterThan(0);
  });

  it('interpreta encabezados y limpia sintaxis Markdown', () => {
    const result = parseText(
      request('# Mi novela\n\n## El bosque\n\nCamino bajo **la luna** y leo [una nota](https://ejemplo.es).', MARKDOWN_MIME, 'borrador.md'),
      () => {},
    );
    expect(result.title).toBe('Mi novela');
    const blocks = result.chapters[0]?.blocks ?? [];
    expect(blocks[0]).toMatchObject({ content: 'El bosque', heading: true });
    expect(blocks[1]).toMatchObject({ content: 'Camino bajo la luna y leo una nota.' });
  });

  it('extrae el título HTML e ignora scripts', () => {
    const result = parseText(
      request('<html><head><title>Una página</title><script>alert(1)</script></head><body><h1>Inicio</h1><p>Texto visible.</p></body></html>', HTML_MIME, 'pagina.html'),
      () => {},
    );
    expect(result.title).toBe('Una página');
    const contents = (result.chapters[0]?.blocks ?? []).map((block) =>
      block.type === 'text' ? block.content : '',
    );
    expect(contents).toContain('Inicio');
    expect(contents.join(' ')).not.toContain('alert');
  });

  it('rechaza archivos vacíos', () => {
    expect(() => parseText(request('   ', TXT_MIME), () => {})).toThrow(ParseError);
  });
});
