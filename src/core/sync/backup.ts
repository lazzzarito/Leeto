import type { SyncEnvelope } from '@/types';
import { parseEnvelope, serializeEnvelope } from './envelope';

export const SYNC_FILENAME = 'leeto_sync.json';
export const BACKUP_FILENAME = 'leeto_sync.backup.json';
export const PREV_BACKUP_FILENAME = 'leeto_sync.backup.prev.json';
export const LAST_APPLIED_KEY = 'leeto_sync.lastApplied.json';

export interface BackupFile {
  savedAt: number;
  envelope: SyncEnvelope;
}

/** Almacén mínimo, compatible con localStorage y con mocks en tests. */
export interface BackupStore {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

export function serializeBackup(envelope: SyncEnvelope, savedAt = Date.now()): string {
  return JSON.stringify({ savedAt, envelope: JSON.parse(serializeEnvelope(envelope)) }, null, 2);
}

export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El backup no contiene JSON válido');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { savedAt?: unknown }).savedAt !== 'number' ||
    !('envelope' in parsed)
  ) {
    throw new Error('Formato de backup inválido');
  }
  const backup = parsed as { savedAt: number; envelope: unknown };
  return {
    savedAt: backup.savedAt,
    envelope: parseEnvelope(JSON.stringify(backup.envelope)),
  };
}

async function readFile(store: BackupStore, key: string): Promise<BackupFile | undefined> {
  const text = await store.getItem(key);
  if (!text) return undefined;
  try {
    return parseBackup(text);
  } catch {
    return undefined;
  }
}

/** Rota el backup anterior y guarda el estado actual antes de aplicar un merge remoto. */
export async function rotateBackup(
  store: BackupStore,
  envelope: SyncEnvelope,
  savedAt = Date.now(),
): Promise<BackupFile> {
  const currentText = await store.getItem(BACKUP_FILENAME);
  if (currentText) await store.setItem(PREV_BACKUP_FILENAME, currentText);

  const backup: BackupFile = { savedAt, envelope };
  const text = serializeBackup(envelope, savedAt);
  await store.setItem(BACKUP_FILENAME, text);
  await store.setItem(LAST_APPLIED_KEY, text);
  return backup;
}

/** Restaura el backup más reciente disponible: principal → anterior → último aplicado. */
export async function restoreBackup(store: BackupStore): Promise<BackupFile | undefined> {
  for (const key of [BACKUP_FILENAME, PREV_BACKUP_FILENAME, LAST_APPLIED_KEY]) {
    const backup = await readFile(store, key);
    if (backup) return backup;
  }
  return undefined;
}

export async function readLastApplied(store: BackupStore): Promise<BackupFile | undefined> {
  return readFile(store, LAST_APPLIED_KEY);
}
