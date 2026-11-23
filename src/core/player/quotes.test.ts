import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import type { LeetoBook } from '@/types';
import { buildQuoteForClip, formatQuoteShareText, softDeleteQuote } from './quotes';
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
  beforeEach(async () => {
    await db.quotes.clear();
  });

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

  it('cita el párrafo completo aunque el clip sea un subtítulo', () => {
    const content = Array.from({ length: 25 }, (_, index) => `palabra${index}`).join(' ');
    const clips = buildClips([
      {
        index: 0,
        title: 'Capítulo 1',
        blocks: [{ id: 'paragraph', type: 'text', content, wordCount: 25 }],
      },
    ]);
    const secondSegment = clips[1]!;

    expect(buildQuoteForClip(book, secondSegment).excerpt).toBe(content);
  });

  it('incluye libro, autor y capítulo al compartir una cita', () => {
    const quote = buildQuoteForClip(book, buildClips(book.chapters)[0]!);

    expect(formatQuoteShareText(book, quote, 'Capítulo 1')).toBe(
      '“Una frase memorable”\n\n— Libro · Autora · Capítulo 1',
    );
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

  it('el borrado local crea un tombstone que la vista ignora', async () => {
    const quote = buildQuoteForClip(book, buildClips(book.chapters)[0]!);
    await db.quotes.put(quote);

    await softDeleteQuote(quote.id, 5000);

    expect(await db.quotes.get(quote.id)).toMatchObject({ deletedAt: 5000, updatedAt: 5000 });
    expect(await db.quotes.filter((item) => !item.deletedAt).count()).toBe(0);
  });
});
