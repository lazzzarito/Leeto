import { db } from '@/core/db/db';
import type { SyncEnvelope } from '@/types';
import { buildEnvelope, isValidProgress, isValidQuote } from './envelope';
import { mergeEnvelopes, type MergeResult } from './merge';

/** Estado local completo, serializado al sobre portable. */
export async function loadLocalEnvelope(deviceId: string, updatedAt = Date.now()): Promise<SyncEnvelope> {
  const [progress, quotes, books] = await Promise.all([
    db.progress.toArray(),
    db.quotes.toArray(),
    db.books.toArray(),
  ]);
  return buildEnvelope({ deviceId, progress, quotes, books, updatedAt });
}

/** Persiste el resultado del merge en una sola transacción (tombstones incluidos). */
export async function applyMergeResult(result: MergeResult): Promise<void> {
  const progress = result.progress.filter(isValidProgress);
  const quotes = result.quotes.filter(isValidQuote);
  await db.transaction('rw', db.progress, db.quotes, async () => {
    if (progress.length) await db.progress.bulkPut(progress);
    if (quotes.length) await db.quotes.bulkPut(quotes);
  });
}

/** Fusiona un sobre remoto con el estado local y persiste el resultado. */
export async function applyRemoteEnvelope(
  remote: SyncEnvelope,
  deviceId: string,
): Promise<MergeResult> {
  const local = await loadLocalEnvelope(deviceId);
  const result = mergeEnvelopes(local, remote);
  await applyMergeResult(result);
  return result;
}
