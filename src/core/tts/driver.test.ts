import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speakText } from './driver';

class FakeUtterance {
  rate = 1;
  lang = '';
  voice?: SpeechSynthesisVoice;
  onboundary?: (event: SpeechSynthesisEvent) => void;
  onend?: () => void;
  onerror?: (event: SpeechSynthesisErrorEvent) => void;

  constructor(public readonly text: string) {}
}

let cancel: ReturnType<typeof vi.fn>;
let speak: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cancel = vi.fn();
  speak = vi.fn();
  vi.stubGlobal('speechSynthesis', {
    cancel,
    speak,
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('speakText', () => {
  it('encola la voz sin cancelar y aplica ritmo e idioma', () => {
    const onBoundary = vi.fn();
    const session = speakText({
      text: 'Una frase de prueba',
      rate: 1.3,
      lang: 'es-ES',
      onBoundary,
    });

    expect(cancel).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalledOnce();
    const utterance = speak.mock.calls[0]?.[0] as unknown as FakeUtterance;
    expect(utterance.text).toBe('Una frase de prueba');
    expect(utterance.rate).toBe(1.3);
    expect(utterance.lang).toBe('es-ES');

    utterance.onboundary?.({ charIndex: 4, name: 'word' } as unknown as SpeechSynthesisEvent);
    expect(onBoundary).toHaveBeenCalledWith({ wordIndex: 1, charIndex: 4 });

    session?.cancel();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('ignora los errores esperados al interrumpir y reporta los reales', () => {
    const onError = vi.fn();
    speakText({ text: 'Texto', onError });
    const utterance = speak.mock.calls[0]?.[0] as unknown as FakeUtterance;

    utterance.onerror?.({ error: 'interrupted' } as unknown as SpeechSynthesisErrorEvent);
    expect(onError).not.toHaveBeenCalled();

    utterance.onerror?.({ error: 'network' } as unknown as SpeechSynthesisErrorEvent);
    expect(onError).toHaveBeenCalledWith('network');
  });
});
