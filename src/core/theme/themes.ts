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
    hint: 'Claro y neutro',
    swatch: ['#ffffff', '#18181b', '#f59e0b'],
  },
  {
    id: 'sepia',
    label: 'Sepia',
    hint: 'Claro y cálido',
    swatch: ['#f3e7d3', '#3d2f1b', '#b45309'],
  },
  {
    id: 'graphite',
    label: 'Grafito',
    hint: 'Oscuro suave',
    swatch: ['#1a1d21', '#eceef1', '#f59e0b'],
  },
  {
    id: 'oled',
    label: 'Noche',
    hint: 'Oscuro puro',
    swatch: ['#000000', '#f5f5f5', '#fbbf24'],
  },
];

export function isReadingTheme(value: string | undefined): value is ReadingTheme {
  return READING_THEMES.some((theme) => theme.id === value);
}
