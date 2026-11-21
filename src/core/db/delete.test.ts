import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LeetoBook, ReadingProgress, SavedQuote, StoredAsset } from '@/types';
import { db } from './db';
import { deleteBookCascade, updateBookMetadata } from './delete';

function makeBook(id: string, imageAssetId?: string): LeetoBook {
  return {
    id,
    contentHash: id,
    title: `Libro ${id}`,
    author: 'Autora',
    fileName: `${id}.epub`,
    fileSize: 100,
    mimeType: 'application/epub+zip',
    saga: 'Saga',
    volumeNumber: 1,
    chapters: [
      {
        index: 0,
        title: 'Capítulo 1',
        blocks: imageAssetId
          ? [{ id: 'b_001', type: 'image', assetId: imageAssetId }]
          : [{ id: 'b_001', type: 'text', content: 'Texto', wordCount: 1 }],
      },
    ],
    totalWordCount: 1,
    coverAssetId: 'cover_1',
    importedAt: 1,
    updatedAt: 1,
  };
}

function makeAsset(id: string, bookId: string): StoredAsset {
  return {
    id,
    bookId,
    kind: id.startsWith('cover') ? 'cover' : 'image',
    mimeType: 'image/png',
    blob: new Blob(['bytes'], { type: 'image/png' }),
    createdAt: 1,
  };
}

function makeProgress(bookId: string): ReadingProgress {
  return {
    bookId,
    chapterIndex: 0,
    blockId: 'b_001',
    percentage: 25,
    updatedAt: 1,
    deviceId: 'dev_test',
  };
}

function makeQuote(id: string, bookId: string): SavedQuote {
  return {
    id,
    bookId,
    chapterIndex: 0,
    blockId: 'b_001',
    excerpt: 'Una cita',
    createdAt: 1,
    updatedAt: 1,
  };
}

async function seed() {
  await db.transaction('rw', db.books, db.assets, db.progress, db.quotes, async () => {
    await db.books.bulkPut([makeBook('a', 'image_shared'), makeBook('b')]);
    await db.assets.bulkPut([
      makeAsset('cover_1', 'a'),
      makeAsset('image_shared', 'a'),
      makeAsset('cover_2', 'b'),
    ]);
    await db.progress.bulkPut([makeProgress('a'), makeProgress('b')]);
    await db.quotes.bulkPut([makeQuote('q_a', 'a'), makeQuote('q_b', 'b')]);
  });
}

describe('gestión segura de la biblioteca', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seed();
  });

  it('elimina libro, progreso, citas y assets en cascada', async () => {
    await deleteBookCascade('a');

    expect(await db.books.get('a')).toBeUndefined();
    expect(await db.progress.get('a')).toBeUndefined();
    expect(await db.quotes.where('bookId').equals('a').count()).toBe(0);
    expect(await db.assets.where('bookId').equals('a').count()).toBe(0);

    expect(await db.books.get('b')).toBeDefined();
    expect(await db.progress.get('b')).toBeDefined();
    expect(await db.quotes.get('q_b')).toBeDefined();
    expect(await db.assets.get('cover_2')).toBeDefined();
  });

  it('actualiza metadatos, reemplaza la portada y borra la antigua huérfana', async () => {
    const coverBlob = new Blob(['nueva'], { type: 'image/jpeg' });
    const updated = await updateBookMetadata('a', {
      title: 'Nuevo título',
      author: 'Nueva autora',
      saga: 'Otra saga',
      volumeNumber: 3,
      cover: { blob: coverBlob, mimeType: 'image/jpeg' },
    });

    expect(updated).toMatchObject({
      title: 'Nuevo título',
      author: 'Nueva autora',
      saga: 'Otra saga',
      volumeNumber: 3,
    });
    expect(updated?.updatedAt).toBeGreaterThan(1);
    expect(await db.books.get('a')).toMatchObject({ title: 'Nuevo título' });
    expect(await db.assets.get('cover_1')).toBeUndefined();
    expect(await db.assets.get(updated?.coverAssetId ?? '')).toMatchObject({
      kind: 'cover',
      mimeType: 'image/jpeg',
    });
  });

  it('conserva la imagen de portada anterior si el cuerpo la sigue usando', async () => {
    await db.books.put({
      ...(await db.books.get('a'))!,
      coverAssetId: 'image_shared',
    });
    const updated = await updateBookMetadata('a', {
      title: 'Cambio',
      author: 'Autora',
      cover: { blob: new Blob(['otra']), mimeType: 'image/png' },
    });

    expect(updated?.coverAssetId).not.toBe('image_shared');
    expect(await db.assets.get('image_shared')).toMatchObject({ kind: 'image' });
    expect(await db.assets.get('cover_1')).toBeUndefined();
  });

  it('devuelve undefined si el libro no existe', async () => {
    await expect(
      updateBookMetadata('inexistente', { title: 'X', author: 'Y' }),
    ).resolves.toBeUndefined();
  });

  it('elimina saga y volumen cuando se dejan vacíos', async () => {
    const updated = await updateBookMetadata('a', { title: 'Libro a', author: 'Autora', saga: '' });
    expect(updated?.saga).toBeUndefined();
    expect(updated?.volumeNumber).toBeUndefined();
  });
});
