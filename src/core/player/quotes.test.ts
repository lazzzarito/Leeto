import { describe, expect, it } from 'vitest';
import type { LeetoBook } from '@/types';
import { buildQuoteForClip } from './quotes';
import { buildClips, type PlayerClip } from './state';

const book: LeetoBook = {
  id: 'book_1',
  contentHash: 'sha256:test',
  title: 'Libro',
  author: 'Autora',
  fileName: 'libro.epub',
  fileSize: 10,
  mimeType: 'application/epub+zip',
  chapters: [
    {
      index: 0,
      title: 'Capítulo 1',
      blocks: [
        { id: 'b_001', type: 'text', content: 'Una frase memorable', wordCount: 3 },
        { id: 'b_002', type: 'image', assetId: 'asset_1', alt: 'Ilustración' },
      ],
    },
  ],
  totalWordCount: 3,
  importedAt: 0,
  updatedAt: 0,
};

describe('citas del reproductor', () => {
  it('guarda la referencia exacta al bloque de texto', () => {
    const clip = buildClips(book.chapters)[0]!;
    const quote = buildQuoteForClip(book, clip, 1234);

    expect(quote).toMatchObject({
      bookId: 'book_1',
      chapterIndex: 0,
      blockId: 'b_001',
      excerpt: 'Una frase memorable',
      createdAt: 1234,
      updatedAt: 1234,
    });
    expect(quote.id).toMatch(/^quote_/);
  });

  it('recorta fragmentos largos y usa el texto alternativo de imágenes', () => {
    const clips = buildClips(book.chapters);
    const longClip: PlayerClip = {
      ...clips[0]!,
      block: { id: 'b_long', type: 'text', content: 'x'.repeat(700), wordCount: 100 },
    };
    expect(buildQuoteForClip(book, longClip).excerpt).toHaveLength(500);
    expect(buildQuoteForClip(book, clips[1]!).excerpt).toBe('Ilustración');
  });
});
