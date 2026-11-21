import { useLiveQuery } from 'dexie-react-hooks';
import { getOrCreateDeviceId } from '@/lib/ids';
import type { AppSettings, ReadingTheme } from '@/types';
import { db } from './db';

export function getInitialTheme(): ReadingTheme {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'oled';
  }
  return 'paper';
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'singleton',
  deviceId: getOrCreateDeviceId(),
  readingTheme: getInitialTheme(),
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
};

/** Devuelve los ajustes persistidos o, si no existen, los valores por defecto. */
export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get('singleton')) ?? DEFAULT_SETTINGS;
}

/** Crea el registro singleton si es la primera ejecución. */
export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('singleton');
  if (!existing) await db.settings.put(DEFAULT_SETTINGS);
  return getSettings();
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...patch, id: 'singleton' };
  await db.settings.put(next);
  return next;
}

/** Hook reactivo: devuelve defaults mientras Dexie carga el registro. */
export function useSettings(): AppSettings {
  const stored = useLiveQuery(() => db.settings.get('singleton'), [], undefined);
  return stored ?? DEFAULT_SETTINGS;
}
