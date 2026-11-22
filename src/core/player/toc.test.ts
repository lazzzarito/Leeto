import { describe, expect, it } from 'vitest';
import type { LeetoChapter, TocEntry } from '@/types';
import { buildClips } from './state';
import {
  ensureToc,
  findActiveTocPath,
  findClipIndexForTocEntry,
  flattenToc,
} from './toc';

const chapters: LeetoChapter[] = [
  {
    index: 0,
    title: 'Capítulo 1',
    blocks: [
      { id: 'b_001', type: 'text', content: 'Uno dos tres', wordCount: 3 },
      { id: 'b_002', type: 'text', content: 'Cuatro cinco seis', wordCount: 3 },
    ],
  },
  {
    index: 1,
    title: 'Capítulo 2',
    blocks: [{ id: 'b_003', type: 'text', content: 'Siete ocho nueve', wordCount: 3 }],
  },
];

const nested: TocEntry[] = [
  {
    id: 'parte',
    title: 'Parte I',
    chapterIndex: 0,
    children: [
      {
        id: 'seccion',
        title: 'La sección',
        chapterIndex: 0,
        blockId: 'b_002',
        children: [
          { id: 'sub', title: 'Subsección', chapterIndex: 1, blockId: 'b_003', children: [] },
        ],
      },
    ],
  },
];

describe('ensureToc', () => {
  it('deriva un índice plano de los capítulos cuando no hay TOC guardado', () => {
    const toc = ensureToc({ chapters });

    expect(toc.map((entry) => [entry.title, entry.blockId])).toEqual([
      ['Capítulo 1', 'b_001'],
      ['Capítulo 2', 'b_003'],
    ]);
  });

  it('conserva la jerarquía y los destinos válidos', () => {
    expect(ensureToc({ chapters, toc: nested })).toEqual(nested);
  });

  it('descarta referencias rotas sin perder los descendientes válidos', () => {
    const toc = ensureToc({
      chapters,
      toc: [
        {
          id: 'roto',
          title: 'Fuera de rango',
          chapterIndex: 99,
          children: [nested[0]!.children[0]!],
        },
      ],
    });

    expect(flattenToc(toc).map((entry) => entry.id)).toEqual(['seccion', 'sub']);
  });
});

describe('resolución TOC ↔ reproductor', () => {
  const clips = buildClips(chapters);

  it('salta al subtítulo exacto de la entrada', () => {
    expect(findClipIndexForTocEntry(nested[0]!.children[0]!, clips)).toBe(1);
  });

  it('cae al primer subtítulo del capítulo si falta el bloque', () => {
    const entry: TocEntry = {
      id: 'sin-bloque',
      title: 'Sin bloque',
      chapterIndex: 1,
      blockId: 'desaparecido',
      children: [],
    };
    expect(findClipIndexForTocEntry(entry, clips)).toBe(2);
  });

  it('devuelve la ruta completa hasta la entrada activa', () => {
    const path = findActiveTocPath(nested, clips[2]);

    expect(path.map((entry) => entry.id)).toEqual(['parte', 'seccion', 'sub']);
  });

  it('devuelve la mejor ruta de capítulo cuando no hay coincidencia de bloque', () => {
    const path = findActiveTocPath(nested, clips[0]);

    expect(path.map((entry) => entry.id)).toEqual(['parte', 'seccion']);
  });
});
