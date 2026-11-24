import { useLiveQuery } from 'dexie-react-hooks';
import { getOrCreateDeviceId } from '@/lib/ids';
import type { AppSettings, ReadingTheme, ScanRoot } from '@/types';
import { db } from './db';

export function getInitialTheme(): ReadingTheme {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'oled';
  }
  return 'paper';
}

const VALID_THEMES = new Set<ReadingTheme>(['paper', 'sepia', 'graphite', 'oled']);
const LEGACY_THEME_MAP: Record<string, ReadingTheme> = { amber: 'sepia', eink: 'paper' };

function bounded(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Normaliza registros antiguos o parciales antes de usarlos en la UI. */
export function normalizeSettings(stored?: Partial<AppSettings>): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...stored, id: 'singleton' as const };
  const theme = LEGACY_THEME_MAP[merged.readingTheme] ?? merged.readingTheme;
  return {
    ...merged,
    deviceId: merged.deviceId || DEFAULT_SETTINGS.deviceId,
    readingTheme: VALID_THEMES.has(theme) ? theme : DEFAULT_SETTINGS.readingTheme,
    themeMode: merged.themeMode === 'manual' ? 'manual' : 'system',
    fontSize: bounded(merged.fontSize, 14, 32, DEFAULT_SETTINGS.fontSize),
    lineHeight: bounded(merged.lineHeight, 1.2, 2.2, DEFAULT_SETTINGS.lineHeight),
    wpm: bounded(merged.wpm, 60, 600, DEFAULT_SETTINGS.wpm),
    playbackSpeed: bounded(merged.playbackSpeed, 0.5, 2, DEFAULT_SETTINGS.playbackSpeed),
    focusDimIntensity: bounded(merged.focusDimIntensity, 0, 1, DEFAULT_SETTINGS.focusDimIntensity),
    imageDurationMs: bounded(merged.imageDurationMs, 1000, 30_000, DEFAULT_SETTINGS.imageDurationMs),
    reducedMotion:
      merged.reducedMotion === 'on' || merged.reducedMotion === 'off'
        ? merged.reducedMotion
        : 'system',
    syncProvider:
      merged.syncProvider === 'webdav' || merged.syncProvider === 'local-folder'
        ? merged.syncProvider
        : 'webdav',
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'singleton',
  deviceId: getOrCreateDeviceId(),
  readingTheme: getInitialTheme(),
  themeMode: 'system',
  fontSize: 20,
  lineHeight: 1.7,
  wpm: 240,
  playbackSpeed: 1,
  kineticTextEnabled: true,
  focusDimIntensity: 0.45,
  imageDurationMs: 6000,
  ttsEnabled: false,
  reducedMotion: 'system',
  syncEnabled: false,
  syncProvider: 'webdav',
  syncWebDavUrl: '',
  syncWebDavUsername: '',
};

/** Devuelve los ajustes persistidos o, si no existen, los valores por defecto. */
export async function getSettings(): Promise<AppSettings> {
  return normalizeSettings(await db.settings.get('singleton'));
}

/** Crea el registro singleton si es la primera ejecución. */
export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('singleton');
  if (!existing) await db.settings.put(DEFAULT_SETTINGS);
  return getSettings();
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = normalizeSettings({ ...current, ...patch });
  await db.settings.put(next);
  return next;
}

export async function addScanRoot(root: ScanRoot): Promise<AppSettings> {
  const current = await getSettings();
  const roots = (current.scanRoots ?? []).filter((item) => item.id !== root.id);
  return updateSettings({ scanRoots: [...roots, root] });
}

export async function removeScanRoot(id: string): Promise<AppSettings> {
  const current = await getSettings();
  return updateSettings({
    scanRoots: (current.scanRoots ?? []).filter((root) => root.id !== id),
  });
}

/** Hook reactivo: devuelve defaults mientras Dexie carga el registro. */
export function useSettings(): AppSettings {
  const stored = useLiveQuery(() => db.settings.get('singleton'), [], undefined);
  return normalizeSettings(stored);
}

/** `true` cuando Dexie ya resolvió la lectura de ajustes (existan o no). */
export function useSettingsLoaded(): boolean {
  return (
    useLiveQuery(async () => (await db.settings.get('singleton')) ?? null, [], 'loading') !==
    'loading'
  );
}
