import { describe, expect, it } from 'vitest';
import { hashFile, hashText } from './hash';

describe('hash utilities', () => {
  it('usa SHA-256 y prefija la identidad de contenido', async () => {
    const hash = await hashFile(new Blob(['contenido de prueba']));
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('el mismo contenido produce el mismo hash', async () => {
    const a = await hashText('Leeto');
    const b = await hashText('Leeto');
    const c = await hashText('leeto');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
