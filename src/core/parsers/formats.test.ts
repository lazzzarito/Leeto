import { describe, expect, it } from 'vitest';
import {
  detectMimeType,
  EPUB_MIME,
  HTML_MIME,
  isBookFile,
  MARKDOWN_MIME,
  PDF_MIME,
  TXT_MIME,
} from './formats';

describe('detectMimeType', () => {
  it('detecta formatos por extensión, sin depender del MIME del navegador', () => {
    expect(detectMimeType({ name: 'LIBRO.EPUB', type: '' })).toBe(EPUB_MIME);
    expect(detectMimeType({ name: 'capitulo.pdf', type: '' })).toBe(PDF_MIME);
    expect(detectMimeType({ name: 'notas.txt', type: '' })).toBe(TXT_MIME);
    expect(detectMimeType({ name: 'libro.md', type: '' })).toBe(MARKDOWN_MIME);
    expect(detectMimeType({ name: 'pagina.html', type: '' })).toBe(HTML_MIME);
  });

  it('acepta el MIME cuando no hay extensión reconocida', () => {
    expect(detectMimeType({ name: 'sin-extension', type: TXT_MIME })).toBe(TXT_MIME);
    expect(detectMimeType({ name: 'otro.bin', type: 'application/octet-stream' })).toBeUndefined();
  });
});

describe('isBookFile', () => {
  it('reconoce todos los formatos importables en una carpeta', () => {
    expect(['a.epub', 'b.PDF', 'c.txt', 'd.md', 'e.htm'].every(isBookFile)).toBe(true);
    expect(isBookFile('portada.jpg')).toBe(false);
  });
});
