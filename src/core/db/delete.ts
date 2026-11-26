import { notifyLocalSyncChange } from '@/core/sync/scheduler';
import { newId } from '@/lib/ids';
import type { LeetoBook, ReadingProgress, SavedQuote, StoredAsset } from '@/types';
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
    notifyLocalSyncChange();
    return next;
  });
}

export interface DeletedBookSnapshot {
  book: LeetoBook;
  progress?: ReadingProgress;
  quotes: SavedQuote[];
  assets: StoredAsset[];
}

/** Borra el libro y deja tombstones de progreso/citas para que el sync no los resucite. */
export async function deleteBookCascade(bookId: string): Promise<DeletedBookSnapshot | undefined> {
  const snapshot = await db.transaction('rw', db.books, db.progress, db.quotes, db.assets, async () => {
    const book = await db.books.get(bookId);
    if (!book) return undefined;
    const [progress, quotes, assets] = await Promise.all([
      db.progress.get(bookId),
      db.quotes.where('bookId').equals(bookId).toArray(),
      db.assets.where('bookId').equals(bookId).toArray(),
    ]);
    const now = Date.now();
    await Promise.all([
      db.books.delete(bookId),
      progress
        ? db.progress.put({ ...progress, deletedAt: now, updatedAt: Math.max(now, progress.updatedAt) })
        : Promise.resolve(),
      quotes.length > 0
        ? db.quotes.bulkPut(
            quotes.map((quote) => ({
              ...quote,
              deletedAt: now,
              updatedAt: Math.max(now, quote.updatedAt),
            })),
          )
        : Promise.resolve(),
      db.assets.bulkDelete(assets.map((asset) => asset.id)),
    ]);
    return { book, progress, quotes, assets };
  });
  if (snapshot) notifyLocalSyncChange();
  return snapshot;
}

export async function restoreBookSnapshot(snapshot: DeletedBookSnapshot): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.books, db.progress, db.quotes, db.assets, async () => {
    await db.books.put({ ...snapshot.book, updatedAt: Math.max(now, snapshot.book.updatedAt) });
    if (snapshot.progress) {
      await db.progress.put({
        ...snapshot.progress,
        deletedAt: undefined,
        updatedAt: Math.max(now, snapshot.progress.updatedAt),
      });
    }
    if (snapshot.quotes.length > 0) {
      await db.quotes.bulkPut(
        snapshot.quotes.map((quote) => ({
          ...quote,
          deletedAt: undefined,
          updatedAt: Math.max(now, quote.updatedAt),
        })),
      );
    }
    if (snapshot.assets.length > 0) await db.assets.bulkPut(snapshot.assets);
  });
  notifyLocalSyncChange();
}
