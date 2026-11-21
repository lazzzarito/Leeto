import { useCallback, useEffect } from 'react';
import { updateSettings, useSettings } from '@/core/db/settings';
import { READING_THEMES } from '@/core/theme/themes';
import type { ReadingTheme } from '@/types';

const THEME_CACHE_KEY = 'leeto.theme';

function readCachedTheme(): ReadingTheme | null {
  try {
    const value = localStorage.getItem(THEME_CACHE_KEY);
    return READING_THEMES.some((theme) => theme.id === value) ? (value as ReadingTheme) : null;
  } catch {
    return null;
  }
}

/** Aplica el tema al elemento root y persiste la elección en Dexie + caché local. */
export function useTheme() {
  const { readingTheme } = useSettings();
  const theme = readCachedTheme() ?? readingTheme;

  useEffect(() => {
    document.documentElement.dataset.readingTheme = theme;
    try {
      localStorage.setItem(THEME_CACHE_KEY, theme);
    } catch {
      // Almacenamiento no disponible: el tema sigue aplicado en esta sesión.
    }
  }, [theme]);

  const setTheme = useCallback((next: ReadingTheme) => {
    document.documentElement.dataset.readingTheme = next;
    try {
      localStorage.setItem(THEME_CACHE_KEY, next);
    } catch {
      // ignorar
    }
    void updateSettings({ readingTheme: next });
  }, []);

  return { theme, setTheme, themes: READING_THEMES };
}
