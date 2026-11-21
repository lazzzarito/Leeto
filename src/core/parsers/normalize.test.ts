import { describe, expect, it } from 'vitest';
import {
  countWords,
  decodeEntities,
  extractImageReferences,
  htmlToBlocks,
  makeBlockIdFactory,
  resolveRelativePath,
} from './normalize';

describe('normalizador de contenido', () => {
  it('decodifica entidades HTML y numéricas', () => {
    expect(decodeEntities('A &amp; B &nbsp; &#x2014; &#233;')).toBe('A & B   — é');
  });

  it('cuenta palabras respetando unicode y guiones', () => {
    expect(countWords('Uno dos tres')).toBe(3);
    expect(countWords('¡Hola!¿Cómo estás?')).toBe(3);
    expect(countWords('')).toBe(0);
  });

  it('resuelve rutas relativas dentro del EPUB', () => {
    expect(resolveRelativePath('OEBPS/content.opf', 'Text/c1.xhtml')).toBe('OEBPS/Text/c1.xhtml');
    expect(resolveRelativePath('OEBPS/Text/c1.xhtml', '../Images/f.png')).toBe(
      'OEBPS/Images/f.png',
    );
    expect(resolveRelativePath('OEBPS/c1.xhtml', 'img%201.png')).toBe('OEBPS/img 1.png');
  });

  it('extrae referencias de imagen sin DOM', () => {
    const refs = extractImageReferences('<img src="../i.png" alt="Figura"><p>texto</p>');
    expect(refs).toEqual([{ src: '../i.png', alt: 'Figura' }]);
  });

  it('genera bloques de texto e imagen en orden con ids estables', () => {
    const nextId = makeBlockIdFactory(1);
    const blocks = htmlToBlocks(
      '<h1>Título</h1><p>Un párrafo.</p><img src="i.png" alt="Figura">',
      (src) => (src === 'i.png' ? 'asset_1' : undefined),
      nextId,
    );

    expect(blocks.map((block) => block.type)).toEqual(['text', 'text', 'image']);
    expect(blocks[0]).toMatchObject({ id: 'b_001', content: 'Título' });
    expect(blocks[1]).toMatchObject({ id: 'b_002', wordCount: 2 });
    expect(blocks[2]).toMatchObject({ id: 'b_003', assetId: 'asset_1', alt: 'Figura' });
  });
});
