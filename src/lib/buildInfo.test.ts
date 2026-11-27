import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';
import { APP_LABEL, APP_VERSION, GITHUB_REPO_URL, IS_BETA, SITE_URL } from './buildInfo';

describe('buildInfo', () => {
  it('deriva la versión visible de package.json sin literals duplicados', () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_LABEL).toBe(`v${packageJson.version} · ${IS_BETA ? 'Beta' : 'Normal'}`);
  });

  it('expone las URLs públicas canónicas', () => {
    expect(SITE_URL).toBe('https://leeto.vercel.app/');
    expect(GITHUB_REPO_URL).toBe('https://github.com/lazzzarito/Leeto');
  });
});
