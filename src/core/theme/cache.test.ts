import { beforeEach, describe, expect, it } from 'vitest';
import { readThemeCache, writeThemeCache } from './cache';

describe('caché del tema', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('recupera el tema y el modo guardados', () => {
    writeThemeCache('sepia', 'manual');

    expect(readThemeCache()).toEqual({ theme: 'sepia', mode: 'manual' });
  });

  it('interpreta la caché antigua como tema manual', () => {
    localStorage.setItem('leeto.theme', 'amber');

    expect(readThemeCache()).toEqual({ theme: 'amber', mode: 'manual' });
  });

  it('ignora valores que no son un tema conocido', () => {
    localStorage.setItem('leeto.theme', '{"theme":"neon","mode":"manual"}');

    expect(readThemeCache()).toBeNull();
  });
});
