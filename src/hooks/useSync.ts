import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '@/core/db/settings';
import { applyMergeResult, loadLocalEnvelope } from '@/core/sync/apply';
import { BACKUP_FILENAME, SYNC_FILENAME, rotateBackup, restoreBackup } from '@/core/sync/backup';
import { getWebDavPassword } from '@/core/sync/credentials';
import { parseEnvelope, serializeEnvelope } from '@/core/sync/envelope';
import { createLocalFolderProvider, getSyncDirectory, isLocalFolderSupported } from '@/core/sync/localFolder';
import { mergeEnvelopes, prepareForWrite } from '@/core/sync/merge';
import { isSecureSyncUrl, type SyncProvider } from '@/core/sync/provider';
import {
  createLoopGuard,
  createSyncScheduler,
  subscribeLocalSyncChange,
} from '@/core/sync/scheduler';
import { createWebDavProvider } from '@/core/sync/webdav';
import type { AppSettings } from '@/types';

export interface SyncStatus {
  phase: 'idle' | 'syncing' | 'ok' | 'error';
  message?: string;
  lastSyncedAt?: number;
}

function buildProvider(settings: AppSettings): SyncProvider {
  if (settings.syncProvider === 'webdav') {
    if (!settings.syncWebDavUrl) throw new Error('Configura la URL WebDAV antes de sincronizar');
    return createWebDavProvider({
      baseUrl: settings.syncWebDavUrl,
      username: settings.syncWebDavUsername,
      password: getWebDavPassword(),
    });
  }
  if (settings.syncProvider === 'local-folder') {
    const directory = getSyncDirectory();
    if (!directory) throw new Error('Elige una carpeta local antes de sincronizar');
    return createLocalFolderProvider(directory);
  }
  throw new Error('Proveedor de sincronización no soportado en esta versión');
}

/** Configuración mínima para hablar con el proveedor, con auto-sync activado o no. */
export function isSyncConfigured(settings: AppSettings): boolean {
  if (settings.syncProvider === 'webdav') {
    return Boolean(settings.syncWebDavUrl) && isSecureSyncUrl(settings.syncWebDavUrl!);
  }
  if (settings.syncProvider === 'local-folder') {
    return isLocalFolderSupported() && Boolean(getSyncDirectory());
  }
  return false;
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
        const created = prepareForWrite(local, current.deviceId);
        await provider.write(SYNC_FILENAME, serializeEnvelope(created));
        guardRef.current.markWritten(created);
        setStatus({
          phase: 'ok',
          message: 'Archivo de sincronización creado',
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

      // Solo publicamos si hay cambios de registros o si el sobre viene de otro dispositivo.
      if (result.changed || parsed.originDeviceId !== current.deviceId) {
        await provider.backupRemote?.(SYNC_FILENAME, BACKUP_FILENAME);
        const written = prepareForWrite(result.envelope, current.deviceId);
        await provider.write(SYNC_FILENAME, serializeEnvelope(written), { etag: remote.etag });
        guardRef.current.markWritten(written);
        setStatus({
          phase: 'ok',
          message: result.changed ? 'Cambios aplicados y publicados' : 'Sincronizado',
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
  }, []);

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
  }, [scheduler, settings.syncEnabled, settings.syncProvider, settings.syncWebDavUrl]);

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
