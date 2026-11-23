import type { ReadingTheme } from '@/types';

export interface ReadingThemeOption {
  id: ReadingTheme;
  label: string;
  hint: string;
  /** Color de muestra para el selector (fondo / primer plano / acento). */
  swatch: [string, string, string];
}

export const READING_THEMES: ReadingThemeOption[] = [
  {
    id: 'paper',
    label: 'Papel',
    hint: 'Fondo claro',
    swatch: ['#ffffff', '#18181b', '#f59e0b'],
  },
  {
    id: 'amber',
    label: 'Ámbar',
    hint: 'Fondo cálido',
    swatch: ['#faf3e7', '#2b1d0c', '#d97706'],
  },
  {
    id: 'sepia',
    label: 'Sepia',
    hint: 'Fondo crema',
    swatch: ['#e9dcc3', '#40301c', '#9a4f1b'],
  },
  {
    id: 'eink',
    label: 'Tinta',
    hint: 'Alto contraste',
    swatch: ['#efefef', '#1a1a1a', '#2e2e2e'],
  },
  {
    id: 'oled',
    label: 'Noche',
    hint: 'Fondo negro',
    swatch: ['#000000', '#f5f5f5', '#fbbf24'],
  },
];

export function isReadingTheme(value: string | undefined): value is ReadingTheme {
  return READING_THEMES.some((theme) => theme.id === value);
}
