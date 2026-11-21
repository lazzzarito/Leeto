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
    hint: 'Lectura diurna neutra',
    swatch: ['#ffffff', '#18181b', '#f59e0b'],
  },
  {
    id: 'amber',
    label: 'Editorial Amber',
    hint: 'Cálida y editorial',
    swatch: ['#faf3e7', '#2b1d0c', '#d97706'],
  },
  {
    id: 'sepia',
    label: 'Sepia Clásico',
    hint: 'Lectura prolongada',
    swatch: ['#e9dcc3', '#40301c', '#9a4f1b'],
  },
  {
    id: 'eink',
    label: 'Tinta E-Ink',
    hint: 'Alto contraste, bajo ruido',
    swatch: ['#efefef', '#1a1a1a', '#2e2e2e'],
  },
  {
    id: 'oled',
    label: 'Noche OLED',
    hint: 'Negro absoluto',
    swatch: ['#000000', '#f5f5f5', '#fbbf24'],
  },
];

export function isReadingTheme(value: string | undefined): value is ReadingTheme {
  return READING_THEMES.some((theme) => theme.id === value);
}
