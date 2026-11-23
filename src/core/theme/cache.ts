import type { ReadingTheme } from '@/types';
import { READING_THEMES } from './themes';

const CACHE_KEY = 'leeto.theme';
const VALID_THEMES = new Set<string>(READING_THEMES.map((option) => option.id));

export type ThemeMode = 'system' | 'manual';

export interface CachedTheme {
  theme: ReadingTheme;
  mode: ThemeMode;
}

/** La caché anterior guardaba solo el tema; se interpreta como elección manual. */
export function readThemeCache(): CachedTheme | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as Partial<CachedTheme>;
      if (!parsed.theme || !VALID_THEMES.has(parsed.theme)) return null;
      return {
        theme: parsed.theme,
        mode: parsed.mode === 'manual' ? 'manual' : 'system',
      };
    }

    return VALID_THEMES.has(raw) ? { theme: raw as ReadingTheme, mode: 'manual' } : null;
  } catch {
    return null;
  }
}

export function writeThemeCache(theme: ReadingTheme, mode: ThemeMode): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ theme, mode }));
  } catch {
    // Sin almacenamiento el tema sigue aplicado mientras dure la sesión.
  }
}
