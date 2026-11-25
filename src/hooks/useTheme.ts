import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateSettings, useSettings, useSettingsLoaded } from '@/core/db/settings';
import { readThemeCache, writeThemeCache } from '@/core/theme/cache';
import {
  applyDynamicPalette,
  cacheDynamicPalette,
  clearDynamicPalette,
  getDynamicPalette,
  listenDynamicPalette,
  readCachedDynamicPalette,
  themeForDynamicPalette,
  type DynamicPalette,
} from '@/core/theme/dynamic';
import { READING_THEMES } from '@/core/theme/themes';
import type { ReadingTheme } from '@/types';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_COLORS: Record<ReadingTheme, string> = {
  paper: '#ffffff',
  sepia: '#f7ecdd',
  graphite: '#1c1e22',
  oled: '#000000',
};

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
  const cached = useMemo(() => readThemeCache(), []);
  const cachedPalette = useMemo(() => readCachedDynamicPalette(), []);
  // Antes de que Dexie responda, respeta la elección manual cacheada por el script inicial.
  const mode = settingsLoaded ? (themeMode ?? 'system') : (cached?.mode ?? 'system');
  // La paleta cacheada ya fue aplicada por el script de index.html: React debe
  // conservarla desde el primer render o se produciría un destello al revés.
  const [dynamicPalette, setDynamicPalette] = useState<DynamicPalette | null>(
    () => (mode === 'system' ? cachedPalette : null),
  );
  const [paletteReady, setPaletteReady] = useState(mode !== 'system' || !!cachedPalette);
  const unsubRef = useRef<(() => void) | undefined>(undefined);
  const storedTheme = settingsLoaded ? readingTheme : (cached?.theme ?? readingTheme);
  const dynamicTheme = themeForDynamicPalette(dynamicPalette);
  const theme: ReadingTheme =
    mode === 'system' ? (dynamicTheme ?? (systemDark ? 'oled' : 'paper')) : storedTheme;

  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined') return;
    const media = window.matchMedia(DARK_QUERY);
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') {
      setDynamicPalette(null);
      setPaletteReady(true);
      return;
    }
    let active = true;
    const receive = (palette: DynamicPalette | null) => {
      if (!active) return;
      cacheDynamicPalette(palette);
      setDynamicPalette(palette);
      setPaletteReady(true);
    };
    void getDynamicPalette().then(receive);
    void listenDynamicPalette(receive)
      .then((unsub) => {
        if (!active) void unsub();
        else unsubRef.current = unsub;
      })
      .catch(() => undefined);
    return () => {
      active = false;
      const unsub = unsubRef.current;
      unsubRef.current = undefined;
      if (unsub) void unsub();
    };
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.readingTheme = theme;
    const dark = theme === 'oled' || theme === 'graphite';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const chromeColor =
      mode === 'system' && dynamicPalette?.available && dynamicPalette.surface
        ? dynamicPalette.surface
        : THEME_COLORS[theme];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', chromeColor);
    if (mode === 'system' && dynamicPalette?.available) {
      applyDynamicPalette(dynamicPalette);
    } else {
      clearDynamicPalette();
    }
    if (settingsLoaded) writeThemeCache(theme, mode);
  }, [theme, mode, settingsLoaded, dynamicPalette]);

  const setTheme = useCallback((next: ReadingTheme) => {
    document.documentElement.dataset.readingTheme = next;
    writeThemeCache(next, 'manual');
    void updateSettings({ readingTheme: next, themeMode: 'manual' });
  }, []);

  const setThemeMode = useCallback((next: 'system' | 'manual') => {
    if (next === 'manual') {
      writeThemeCache(theme, 'manual');
      void updateSettings({ themeMode: 'manual', readingTheme: theme });
      return;
    }
    void updateSettings({ themeMode: 'system' });
  }, [theme]);

  return { theme, setTheme, themeMode: mode, setThemeMode, themes: READING_THEMES, paletteReady };
}
