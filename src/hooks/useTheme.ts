import { useCallback, useEffect, useState } from 'react';
import { updateSettings, useSettings } from '@/core/db/settings';
import { READING_THEMES } from '@/core/theme/themes';
import type { ReadingTheme } from '@/types';

const THEME_CACHE_KEY = 'leeto.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readCachedTheme(): ReadingTheme | null {
  try {
    const value = localStorage.getItem(THEME_CACHE_KEY);
    return READING_THEMES.some((theme) => theme.id === value) ? (value as ReadingTheme) : null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

/**
 * Tema reactivo: por defecto sigue al sistema (paper/oled) y permite fijar uno
 * manualmente. El resultado se aplica al root y se cachea para el primer paint.
 */
export function useTheme() {
  const { readingTheme, themeMode } = useSettings();
  const [systemDark, setSystemDark] = useState(prefersDark);
  const mode = themeMode ?? 'system';
  const manualTheme = readCachedTheme() ?? readingTheme;
  const theme: ReadingTheme = mode === 'system' ? (systemDark ? 'oled' : 'paper') : manualTheme;

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.readingTheme = theme;
    document.documentElement.style.colorScheme = theme === 'oled' ? 'dark' : 'light';
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
    void updateSettings({ readingTheme: next, themeMode: 'manual' });
  }, []);

  const setThemeMode = useCallback((next: 'system' | 'manual') => {
    void updateSettings({ themeMode: next });
  }, []);

  return { theme, setTheme, themeMode: mode, setThemeMode, themes: READING_THEMES };
}
