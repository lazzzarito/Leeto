import type { ParseResult } from '@/core/parsers/types';
import type { LeetoBook, ReadingProgress, StoredAsset } from '@/types';
import { db } from './db';
import { booksRepo } from './repositories';
import { getSettings } from './settings';

export async function isDuplicate(contentHash: string): Promise<boolean> {
  return Boolean(await booksRepo.get(contentHash));
}

/** Persiste libro, assets y progreso inicial en una sola transacción. */
export async function persistParseResult(result: ParseResult): Promise<LeetoBook> {
  const settings = await getSettings();
  const now = Date.now();
  const volumeNumber = result.volumeNumber;

  const book: LeetoBook = {
    id: result.contentHash,
    contentHash: result.contentHash,
    title: result.title,
    author: result.author,
    ...(result.language ? { language: result.language } : {}),
    ...(result.coverAssetId ? { coverAssetId: result.coverAssetId } : {}),
    fileName: result.fileName,
    fileSize: result.fileSize,
    mimeType: result.mimeType,
    ...(result.saga ? { saga: result.saga } : {}),
    ...(typeof volumeNumber === 'number' && Number.isFinite(volumeNumber) ? { volumeNumber } : {}),
    chapters: result.chapters,
    totalWordCount: result.totalWordCount,
    importedAt: now,
    updatedAt: now,
  };

  const assets: StoredAsset[] = result.assets.map((asset) => ({
    id: asset.id,
    bookId: book.id,
    kind: asset.kind,
    mimeType: asset.mimeType,
    blob: new Blob([asset.bytes], { type: asset.mimeType }),
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
    createdAt: now,
  }));

  const firstBlockId = result.chapters[0]?.blocks[0]?.id ?? '';
  const progress: ReadingProgress = {
    bookId: book.id,
    chapterIndex: 0,
    blockId: firstBlockId,
    percentage: 0,
    updatedAt: now,
    deviceId: settings.deviceId,
  };

  await db.transaction('rw', db.books, db.assets, db.progress, async () => {
    await db.books.put(book);
    if (assets.length > 0) await db.assets.bulkPut(assets);
    await db.progress.put(progress);
  });

  return book;
}
