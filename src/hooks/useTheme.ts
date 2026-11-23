import { useCallback, useEffect, useState } from 'react';
import { updateSettings, useSettings, useSettingsLoaded } from '@/core/db/settings';
import { readThemeCache, writeThemeCache } from '@/core/theme/cache';
import { READING_THEMES } from '@/core/theme/themes';
import type { ReadingTheme } from '@/types';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

/**
 * Tema reactivo: por defecto sigue al sistema (paper/oled) y permite fijar uno
 * manualmente. El resultado se aplica al root y se cachea para el primer paint.
 */
export function useTheme() {
  const { readingTheme, themeMode } = useSettings();
  const settingsLoaded = useSettingsLoaded();
  const [systemDark, setSystemDark] = useState(prefersDark);
  const mode = themeMode ?? 'system';
  const cached = readThemeCache();
  const storedTheme =
    settingsLoaded || cached?.mode !== 'manual' ? readingTheme : (cached?.theme ?? readingTheme);
  const theme: ReadingTheme = mode === 'system' ? (systemDark ? 'oled' : 'paper') : storedTheme;

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
    if (settingsLoaded) writeThemeCache(theme, mode);
  }, [theme, mode, settingsLoaded]);

  const setTheme = useCallback((next: ReadingTheme) => {
    document.documentElement.dataset.readingTheme = next;
    writeThemeCache(next, 'manual');
    void updateSettings({ readingTheme: next, themeMode: 'manual' });
  }, []);

  const setThemeMode = useCallback((next: 'system' | 'manual') => {
    void updateSettings({ themeMode: next });
  }, []);

  return { theme, setTheme, themeMode: mode, setThemeMode, themes: READING_THEMES };
}
