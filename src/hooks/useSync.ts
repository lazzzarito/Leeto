import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateScanRoot, useSettings } from '@/core/db/settings';
import { applyMergeResult, loadLocalEnvelope } from '@/core/sync/apply';
import { BACKUP_FILENAME, SYNC_FILENAME, rotateBackup, restoreBackup } from '@/core/sync/backup';
import { parseEnvelope, serializeEnvelope } from '@/core/sync/envelope';
import { createGoogleDriveProvider } from '@/core/sync/googleDrive';
import { syncLibraryFiles } from '@/core/sync/library';
import { createLocalFolderProvider, getSyncDirectory, isLocalFolderSupported } from '@/core/sync/localFolder';
import { mergeEnvelopes, prepareForWrite } from '@/core/sync/merge';
import type { SyncProvider } from '@/core/sync/provider';
import {
  createLoopGuard,
  createSyncScheduler,
  subscribeLocalSyncChange,
} from '@/core/sync/scheduler';
import type { AppSettings, SyncEnvelope } from '@/types';

export interface SyncStatus {
  phase: 'idle' | 'syncing' | 'ok' | 'error';
  message?: string;
  lastSyncedAt?: number;
}

function buildProvider(settings: AppSettings): SyncProvider {
  if (settings.syncProvider === 'gdrive') return createGoogleDriveProvider();
  const directory = getSyncDirectory();
  if (!directory) throw new Error('Elige una carpeta local antes de sincronizar');
  return createLocalFolderProvider(directory);
}

/** Configuración mínima para hablar con el proveedor, con auto-sync activado o no. */
export function isSyncConfigured(settings: AppSettings): boolean {
  if (settings.syncProvider === 'gdrive') return false;
  return isLocalFolderSupported() && Boolean(getSyncDirectory());
}

/** El scheduler y el botón manual comparten la misma comprobación. */
export function canSync(settings: AppSettings): boolean {
  return settings.syncEnabled && isSyncConfigured(settings);
}

async function saveBackup(envelope: Parameters<typeof rotateBackup>[1]) {
  try {
    await rotateBackup(localStorage, envelope);
  } catch {
    throw new Error('No se pudo guardar el backup local; revisa el almacenamiento del navegador');
  }
}

/** Orquesta backup → lectura → merge por registro → escritura condicional. */
export function useSync() {
  const settings = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const guardRef = useRef(createLoopGuard(settings.deviceId));

  const [status, setStatus] = useState<SyncStatus>({ phase: 'idle' });

  const syncLibraryForProvider = useCallback(
    async (provider: SyncProvider, refs: SyncEnvelope['libraryRefs']) => {
      const stats = await syncLibraryFiles(provider, refs ?? {});
      if (stats.uploaded || stats.applied) {
        const now = Date.now();
        await Promise.all(
          (settingsRef.current.scanRoots ?? []).map((root) =>
            updateScanRoot(root.id, { syncedAt: now }),
          ),
        );
      }
      return stats;
    },
    [],
  );

  const runSync = useCallback(async () => {
    const current = settingsRef.current;
    setStatus({ phase: 'syncing' });
    try {
      const provider = buildProvider(current);
      const local = await loadLocalEnvelope(current.deviceId);
      // Backup local del último estado aplicado antes de tocar nada remoto.
      await saveBackup(local);

      const remote = await provider.read(SYNC_FILENAME);
      if (!remote.text) {
        const libraryStats = await syncLibraryForProvider(provider, local.libraryRefs);
        const created = prepareForWrite(local, current.deviceId);
        await provider.write(SYNC_FILENAME, serializeEnvelope(created));
        guardRef.current.markWritten(created);
        setStatus({
          phase: 'ok',
          message: `Sincronización creada · ${libraryStats.uploaded} libros subidos`,
          lastSyncedAt: created.updatedAt,
        });
        return;
      }

      const parsed = parseEnvelope(remote.text);
      if (guardRef.current.shouldSkip(parsed)) {
        setStatus({ phase: 'ok', message: 'Ya estabas al día', lastSyncedAt: parsed.updatedAt });
        return;
      }

      const result = mergeEnvelopes(local, parsed);
      if (result.changed) await applyMergeResult(result);
      const libraryStats = await syncLibraryForProvider(provider, result.libraryRefs);

      // Solo publicamos si hay cambios de registros o si el sobre viene de otro dispositivo.
      if (result.changed || parsed.originDeviceId !== current.deviceId) {
        await provider.backupRemote?.(SYNC_FILENAME, BACKUP_FILENAME);
        const written = prepareForWrite(result.envelope, current.deviceId);
        await provider.write(SYNC_FILENAME, serializeEnvelope(written), { etag: remote.etag });
        guardRef.current.markWritten(written);
        setStatus({
          phase: 'ok',
          message: `${result.changed ? 'Cambios aplicados y publicados' : 'Sincronizado'} · ${libraryStats.applied} libros restaurados, ${libraryStats.uploaded} subidos`,
          lastSyncedAt: written.updatedAt,
        });
      } else {
        setStatus({ phase: 'ok', message: 'Sin cambios', lastSyncedAt: parsed.updatedAt });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ phase: 'error', message });
      throw error;
    }
  }, [syncLibraryForProvider]);

  const scheduler = useMemo(
    () => createSyncScheduler({ run: runSync, debounceMs: 800, minIntervalMs: 5000 }),
    [runSync],
  );

  useEffect(() => {
    const unsubscribe = subscribeLocalSyncChange(() => {
      if (canSync(settingsRef.current)) scheduler.trigger();
    });
    scheduler.start();
    return () => {
      unsubscribe();
      scheduler.stop();
    };
  }, [scheduler]);

  useEffect(() => {
    if (canSync(settingsRef.current)) scheduler.trigger();
  }, [scheduler, settings.syncEnabled, settings.syncProvider]);

  const exportJson = useCallback(async () => {
    const envelope = await loadLocalEnvelope(settingsRef.current.deviceId);
    const blob = new Blob([serializeEnvelope(envelope)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = SYNC_FILENAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Firefox y Safari cancelan la descarga si se revoca el objeto en el mismo tick.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const importJson = useCallback(async (text: string) => {
    try {
      const imported = parseEnvelope(text);
      const local = await loadLocalEnvelope(settingsRef.current.deviceId);
      await saveBackup(local);
      const result = mergeEnvelopes(local, imported);
      await applyMergeResult(result);
      setStatus({
        phase: 'ok',
        message: result.changed ? 'Importación fusionada' : 'Importación sin cambios',
        lastSyncedAt: imported.updatedAt,
      });
    } catch (error) {
      setStatus({
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, []);

  const restoreBackupNow = useCallback(async () => {
    try {
      const backup = await restoreBackup(localStorage);
      if (!backup) throw new Error('No hay ningún backup disponible en este dispositivo');
      const local = await loadLocalEnvelope(settingsRef.current.deviceId);
      await saveBackup(local);
      const result = mergeEnvelopes(local, backup.envelope);
      await applyMergeResult(result);
      setStatus({ phase: 'ok', message: 'Backup restaurado', lastSyncedAt: backup.savedAt });
    } catch (error) {
      setStatus({
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, []);

  return {
    status,
    schedulerState: scheduler.state,
    syncNow: () => scheduler.runNow(),
    exportJson,
    importJson,
    restoreBackupNow,
  };
}
