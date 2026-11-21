import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareText } from './share';

const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

afterEach(() => {
  if (shareDescriptor) Object.defineProperty(navigator, 'share', shareDescriptor);
  else Reflect.deleteProperty(navigator, 'share');
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('shareText', () => {
  it('usa Web Share cuando está disponible', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    expect(await shareText('fragmento', 'Libro')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Libro', text: 'fragmento' });
  });

  it('copia al portapapeles cuando no hay Web Share', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    expect(await shareText('fragmento', 'Libro')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('fragmento');
  });

  it('informa cuando no hay ningún mecanismo disponible', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });

    expect(await shareText('fragmento', 'Libro')).toBe('unsupported');
  });
});
