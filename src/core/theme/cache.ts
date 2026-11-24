import type { ReadingTheme } from '@/types';
import { READING_THEMES } from './themes';

const CACHE_KEY = 'leeto.theme';
const VALID_THEMES = new Set<string>(READING_THEMES.map((option) => option.id));
const LEGACY_THEME_MAP: Record<string, ReadingTheme> = {
  amber: 'sepia',
  eink: 'paper',
};

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

    const resolve = (value: string | undefined): ReadingTheme | null => {
      if (!value) return null;
      if (VALID_THEMES.has(value)) return value as ReadingTheme;
      return LEGACY_THEME_MAP[value] ?? null;
    };

    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as Partial<CachedTheme>;
      const theme = resolve(parsed.theme);
      if (!theme) return null;
      return { theme, mode: parsed.mode === 'manual' ? 'manual' : 'system' };
    }

    const theme = resolve(raw);
    return theme ? { theme, mode: 'manual' } : null;
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
