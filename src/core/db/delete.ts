import { newId } from '@/lib/ids';
import type { LeetoBook, StoredAsset } from '@/types';
import { db } from './db';

export interface BookMetadataPatch {
  title: string;
  author: string;
  saga?: string;
  volumeNumber?: number;
  cover?: { blob: Blob; mimeType: string };
}

function isReferencedByBlocks(book: LeetoBook, assetId: string): boolean {
  return book.chapters.some((chapter) =>
    chapter.blocks.some((block) => block.type === 'image' && block.assetId === assetId),
  );
}

/** Actualiza metadatos y portada en una transacción, limpiando el asset anterior huérfano. */
export async function updateBookMetadata(
  bookId: string,
  patch: BookMetadataPatch,
): Promise<LeetoBook | undefined> {
  return db.transaction('rw', db.books, db.assets, async () => {
    const book = await db.books.get(bookId);
    if (!book) return undefined;

    const now = Date.now();
    const next: LeetoBook = {
      ...book,
      title: patch.title.trim() || book.title,
      author: patch.author.trim() || book.author,
      ...(patch.saga && patch.saga.trim() ? { saga: patch.saga.trim() } : { saga: undefined }),
      ...(typeof patch.volumeNumber === 'number' && Number.isFinite(patch.volumeNumber)
        ? { volumeNumber: patch.volumeNumber }
        : { volumeNumber: undefined }),
      updatedAt: now,
    };

    let newCover: StoredAsset | undefined;
    if (patch.cover) {
      newCover = {
        id: newId('asset'),
        bookId,
        kind: 'cover',
        mimeType: patch.cover.mimeType || 'application/octet-stream',
        blob: patch.cover.blob,
        createdAt: now,
      };
      next.coverAssetId = newCover.id;
    }

    if (newCover) {
      // Limpia cualquier portada anterior del libro: se conserva como imagen
      // solo si algún bloque del cuerpo todavía la referencia.
      const previousCovers = await db.assets
        .where('bookId')
        .equals(bookId)
        .filter((asset) => asset.kind === 'cover' && asset.id !== newCover.id)
        .toArray();
      for (const asset of previousCovers) {
        if (isReferencedByBlocks(book, asset.id)) {
          await db.assets.put({ ...asset, kind: 'image' });
        } else {
          await db.assets.delete(asset.id);
        }
      }
      await db.assets.put(newCover);
    }
    await db.books.put(next);
    return next;
  });
}

/** Borra libro, progreso, citas y todos sus assets en una sola transacción. */
export async function deleteBookCascade(bookId: string): Promise<void> {
  await db.transaction('rw', db.books, db.progress, db.quotes, db.assets, async () => {
    const quoteIds = await db.quotes.where('bookId').equals(bookId).primaryKeys();
    const assetIds = await db.assets.where('bookId').equals(bookId).primaryKeys();
    await Promise.all([
      db.books.delete(bookId),
      db.progress.delete(bookId),
      db.quotes.bulkDelete(quoteIds),
      db.assets.bulkDelete(assetIds),
    ]);
  });
}
