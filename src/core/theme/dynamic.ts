import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ReadingTheme } from '@/types';

export interface DynamicPalette {
  available: boolean;
  dark?: boolean;
  primary?: string;
  onPrimary?: string;
  surface?: string;
  onSurface?: string;
  surfaceContainer?: string;
  outline?: string;
  accent?: string;
}

interface LeetoThemePlugin {
  getPalette(): Promise<DynamicPalette>;
  addListener(event: 'paletteChanged', callback: (palette: DynamicPalette) => void): Promise<{ remove: () => Promise<void> }>;
}

const plugin = Capacitor.isNativePlatform() ? registerPlugin<LeetoThemePlugin>('LeetoTheme') : null;

export async function getDynamicPalette(): Promise<DynamicPalette | null> {
  if (!plugin) return null;
  try {
    return await plugin.getPalette();
  } catch {
    return null;
  }
}

export async function listenDynamicPalette(callback: (palette: DynamicPalette) => void) {
  if (!plugin) return () => undefined;
  const handle = await plugin.addListener('paletteChanged', callback);
  return () => void handle.remove();
}

function hexToHslTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function contrastFg(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '240 10% 3.9%' : '0 0% 98%';
}

const DYN_CACHE_KEY = 'leeto.dynamic-palette';

interface CachedDynamicPalette {
  palette: DynamicPalette;
  vars: Record<string, string>;
}

/** Mismo mapa que aplica React; se guarda para que el script inicial lo reutilice sin conversiones. */
export function paletteCssVars(palette: DynamicPalette): Record<string, string> {
  if (!palette.available || !palette.surface || !palette.primary) return {};
  const bg = hexToHslTriplet(palette.surface);
  const fg = hexToHslTriplet(palette.onSurface ?? '#FFFFFF');
  const card = hexToHslTriplet(palette.surfaceContainer ?? palette.surface);
  const primary = hexToHslTriplet(palette.primary);
  const accent = hexToHslTriplet(palette.accent ?? palette.primary);
  const border = hexToHslTriplet(palette.outline ?? palette.surfaceContainer ?? palette.surface);

  return {
    '--background': bg,
    '--foreground': fg,
    '--card': card,
    '--card-foreground': fg,
    '--popover': card,
    '--popover-foreground': fg,
    '--muted': card,
    '--muted-foreground': palette.dark ? '240 5% 64.9%' : '240 3.8% 46.1%',
    '--primary': primary,
    '--primary-foreground': contrastFg(palette.primary),
    '--secondary': card,
    '--secondary-foreground': fg,
    '--accent': accent,
    '--accent-foreground': contrastFg(palette.accent ?? palette.primary),
    '--border': border,
    '--input': border,
    '--ring': primary,
    '--reader-bg': bg,
    '--reader-fg': fg,
    '--reader-highlight': accent,
    // La portada de arranque usa esta variable: sincronizarla evita el cambio de color.
    '--boot-bg': bg,
  };
}

export function cacheDynamicPalette(palette: DynamicPalette | null): void {
  try {
    const vars = palette ? paletteCssVars(palette) : {};
    if (Object.keys(vars).length === 0 || !palette) {
      localStorage.removeItem(DYN_CACHE_KEY);
      return;
    }
    const cached: CachedDynamicPalette = { palette, vars };
    localStorage.setItem(DYN_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Sin almacenamiento el tema dinámico sigue aplicado mientras dure la sesión.
  }
}

export function readCachedDynamicPalette(): DynamicPalette | null {
  try {
    const raw = localStorage.getItem(DYN_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedDynamicPalette>;
    const palette = cached.palette;
    if (!palette?.available || !palette.surface || !palette.primary) return null;
    return palette;
  } catch {
    return null;
  }
}

export function applyDynamicPalette(palette: DynamicPalette) {
  const vars = paletteCssVars(palette);
  if (Object.keys(vars).length === 0) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
}

export function clearDynamicPalette() {
  const root = document.documentElement;
  for (const key of [
    '--background','--foreground','--card','--card-foreground','--popover','--popover-foreground',
    '--muted','--muted-foreground','--primary','--primary-foreground','--secondary','--secondary-foreground',
    '--accent','--accent-foreground','--border','--input','--ring','--reader-bg','--reader-fg',
    '--reader-highlight','--boot-bg',
  ]) root.style.removeProperty(key);
}

export function themeForDynamicPalette(palette: DynamicPalette | null): ReadingTheme | null {
  if (!palette?.available) return null;
  return palette.dark ? 'graphite' : 'paper';
}
