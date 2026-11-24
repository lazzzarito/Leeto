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

export function applyDynamicPalette(palette: DynamicPalette) {
  if (!palette.available || !palette.surface || !palette.primary) return;
  const root = document.documentElement;
  const bg = hexToHslTriplet(palette.surface);
  const fg = hexToHslTriplet(palette.onSurface ?? '#FFFFFF');
  const card = hexToHslTriplet(palette.surfaceContainer ?? palette.surface);
  const primary = hexToHslTriplet(palette.primary);
  const accent = hexToHslTriplet(palette.accent ?? palette.primary);
  const border = hexToHslTriplet(palette.outline ?? palette.surfaceContainer ?? palette.surface);
  const primaryFg = contrastFg(palette.primary);

  root.style.setProperty('--background', bg);
  root.style.setProperty('--foreground', fg);
  root.style.setProperty('--card', card);
  root.style.setProperty('--card-foreground', fg);
  root.style.setProperty('--popover', card);
  root.style.setProperty('--popover-foreground', fg);
  root.style.setProperty('--muted', card);
  root.style.setProperty('--muted-foreground', palette.dark ? '240 5% 64.9%' : '240 3.8% 46.1%');
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-foreground', primaryFg);
  root.style.setProperty('--secondary', card);
  root.style.setProperty('--secondary-foreground', fg);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-foreground', contrastFg(palette.accent ?? palette.primary));
  root.style.setProperty('--border', border);
  root.style.setProperty('--input', border);
  root.style.setProperty('--ring', primary);
  root.style.setProperty('--reader-bg', bg);
  root.style.setProperty('--reader-fg', fg);
  root.style.setProperty('--reader-highlight', accent);
}

export function clearDynamicPalette() {
  const root = document.documentElement;
  for (const key of [
    '--background','--foreground','--card','--card-foreground','--popover','--popover-foreground',
    '--muted','--muted-foreground','--primary','--primary-foreground','--secondary','--secondary-foreground',
    '--accent','--accent-foreground','--border','--input','--ring','--reader-bg','--reader-fg',
    '--reader-highlight',
  ]) root.style.removeProperty(key);
}

export function themeForDynamicPalette(palette: DynamicPalette | null): ReadingTheme | null {
  if (!palette?.available) return null;
  return palette.dark ? 'graphite' : 'paper';
}
