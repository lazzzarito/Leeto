import { describe, expect, it } from 'vitest';
import { findClipIndex } from './resolve';
import { buildClips, type PlayerClip } from './state';

const clips: PlayerClip[] = buildClips([
  {
    index: 0,
    title: 'Capítulo',
    blocks: [
      {
        id: 'paragraph',
        type: 'text',
        content: 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte veintiuno veintidós veintitrés veinticuatro veinticinco',
        wordCount: 25,
      },
    ],
  },
]);

describe('findClipIndex', () => {
  it('resume en el subtítulo guardado', () => {
    expect(findClipIndex(clips, { blockId: 'paragraph', segmentIndex: 1 })).toBe(1);
  });

  it('cae al primer subtítulo del bloque si el guardado no tiene segmento', () => {
    expect(findClipIndex(clips, { blockId: 'paragraph' })).toBe(0);
  });

  it('cae al primer subtítulo del bloque si el segmento ya no existe', () => {
    expect(findClipIndex(clips, { blockId: 'paragraph', segmentIndex: 99 })).toBe(0);
  });

  it('empieza desde el principio cuando el bloque no existe', () => {
    expect(findClipIndex(clips, { blockId: 'desaparecido', segmentIndex: 2 })).toBe(0);
  });
});
