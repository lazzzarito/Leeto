import { normalizeSettings } from '@/core/db/settings';
import type { AppSettings, ScanRoot, SyncSettingsValues } from '@/types';

/** Serializa solo preferencias; nunca deviceId, credenciales ni handles de directorio. */
export function pickSyncedSettings(settings: AppSettings): SyncSettingsValues {
  const roots: Array<Omit<ScanRoot, 'handle'>> = (settings.scanRoots ?? []).map((root) => ({
    id: root.id,
    name: root.name,
    addedAt: root.addedAt,
    ...(root.bookCount === undefined ? {} : { bookCount: root.bookCount }),
    ...(root.totalSize === undefined ? {} : { totalSize: root.totalSize }),
    ...(root.syncedAt === undefined ? {} : { syncedAt: root.syncedAt }),
    ...(root.origin === undefined ? {} : { origin: root.origin }),
  }));

  return {
    readingTheme: settings.readingTheme,
    themeMode: settings.themeMode,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    wpm: settings.wpm,
    playbackSpeed: settings.playbackSpeed,
    kineticTextEnabled: settings.kineticTextEnabled,
    focusDimIntensity: settings.focusDimIntensity,
    imageDurationMs: settings.imageDurationMs,
    ttsEnabled: settings.ttsEnabled,
    ttsVoiceURI: settings.ttsVoiceURI,
    reducedMotion: settings.reducedMotion,
    scanRoots: roots,
  };
}

/** Fusiona preferencias remotas conservando la identidad y el acceso local a carpetas. */
export function mergeSyncedSettings(
  local: AppSettings,
  incoming: SyncSettingsValues,
): Partial<AppSettings> {
  const normalized = normalizeSettings({
    ...local,
    ...incoming,
    id: 'singleton',
    deviceId: local.deviceId,
    syncEnabled: local.syncEnabled,
    syncProvider: local.syncProvider,
  });

  const localRoots = new Map((local.scanRoots ?? []).map((root) => [root.id, root]));
  const mergedRoots: ScanRoot[] = (normalized.scanRoots ?? []).map((root) => {
    const existing = localRoots.get(root.id);
    return existing ? { ...existing, ...root, handle: existing.handle } : root;
  });
  for (const root of local.scanRoots ?? []) {
    if (!mergedRoots.some((item) => item.id === root.id)) mergedRoots.push(root);
  }

  return { ...pickSyncedSettings(normalized), scanRoots: mergedRoots };
}
