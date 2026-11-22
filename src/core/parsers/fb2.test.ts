import { describe, expect, it } from 'vitest';
import { FB2_MIME } from './formats';
import { parseFb2 } from './fb2';
import type { ParseRequest } from './types';

const COVER_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribsko.ru/fictionbook/2" xmlns:l="http://www.w3.org/1999/xlink">
  <description><title-info>
    <genre>fiction</genre>
    <author><first-name>Ana</first-name><last-name>Ruiz</last-name></author>
    <book-title>El invierno</book-title>
    <lang>es</lang>
    <coverpage><image l:href="#portada.png"/></coverpage>
  </title-info></description>
  <body>
    <section><title><p>Primera parte</p></title><p>Un texto con <em>énfasis</em>.</p></section>
    <section><title><p>Segunda parte</p></title><p>Otro párrafo.</p><p><image l:href="#portada.png"/></p></section>
  </body>
  <binary id="portada.png" content-type="image/png">${COVER_BASE64}</binary>
</FictionBook>`;

function request(): ParseRequest {
  const bytes = new TextEncoder().encode(XML) as Uint8Array<ArrayBuffer>;
  return {
    contentHash: 'sha256:fb2',
    fileName: 'invierno.fb2',
    fileSize: bytes.byteLength,
    mimeType: FB2_MIME,
    bytes,
  };
}

describe('parseFb2', () => {
  it('extrae metadatos, secciones, portada e imágenes', () => {
    const result = parseFb2(request(), () => {});

    expect(result.title).toBe('El invierno');
    expect(result.author).toBe('Ana Ruiz');
    expect(result.language).toBe('es');
    expect(result.chapters.map((chapter) => chapter.title)).toEqual(['Primera parte', 'Segunda parte']);
    expect(result.chapters[0]?.blocks[0]).toMatchObject({ type: 'text', content: 'Un texto con énfasis.' });
    expect(result.coverAssetId).toBeTruthy();
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.mimeType).toBe('image/png');
    expect(result.chapters[1]?.blocks.some((block) => block.type === 'image')).toBe(true);
    expect(result.totalWordCount).toBeGreaterThan(0);
  });
});
