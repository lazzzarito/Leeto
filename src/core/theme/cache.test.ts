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
    localStorage.setItem('leeto.theme', 'graphite');

    expect(readThemeCache()).toEqual({ theme: 'graphite', mode: 'manual' });
  });

  it('migra temas antiguos a los 4 temas actuales', () => {
    localStorage.setItem('leeto.theme', 'amber');
    expect(readThemeCache()).toEqual({ theme: 'sepia', mode: 'manual' });
    localStorage.setItem('leeto.theme', '{"theme":"eink","mode":"system"}');
    expect(readThemeCache()).toEqual({ theme: 'paper', mode: 'system' });
  });

  it('ignora valores que no son un tema conocido', () => {
    localStorage.setItem('leeto.theme', '{"theme":"neon","mode":"manual"}');

    expect(readThemeCache()).toBeNull();
  });
});
