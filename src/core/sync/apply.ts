import { getSettings, updateSettings } from '@/core/db/settings';
import { db } from '@/core/db/db';
import type { SyncEnvelope } from '@/types';
import { buildEnvelope, isValidProgress, isValidQuote } from './envelope';
import { mergeEnvelopes, type MergeResult } from './merge';
import { mergeSyncedSettings } from './settingsSync';

/** Estado local completo, serializado al sobre portable. */
export async function loadLocalEnvelope(deviceId: string, updatedAt = Date.now()): Promise<SyncEnvelope> {
  const [progress, quotes, books, settings] = await Promise.all([
    db.progress.toArray(),
    db.quotes.toArray(),
    db.books.toArray(),
    getSettings(),
  ]);
  return buildEnvelope({ deviceId, progress, quotes, books, settings, updatedAt });
}

/** Persiste el resultado del merge en una sola transacción (tombstones incluidos). */
export async function applyMergeResult(result: MergeResult): Promise<void> {
  const progress = result.progress.filter(isValidProgress);
  const quotes = result.quotes.filter(isValidQuote);
  await db.transaction('rw', db.progress, db.quotes, async () => {
    if (progress.length) await db.progress.bulkPut(progress);
    if (quotes.length) await db.quotes.bulkPut(quotes);
  });
  if (result.syncedSettings) {
    await updateSettings(mergeSyncedSettings(await getSettings(), result.syncedSettings));
  }
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
