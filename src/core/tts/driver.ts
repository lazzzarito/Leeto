export interface TtsBoundary {
  wordIndex: number;
  charIndex: number;
}

export interface TtsSession {
  cancel(): void;
  pause(): void;
  resume(): void;
}

/** `cancel()` al cambiar de fragmento provoca estos errores esperados del navegador. */
const EXPECTED_TTS_ERRORS = new Set(['interrupted', 'canceled', 'cancelled']);

export interface SpeakOptions {
  text: string;
  voiceURI?: string;
  lang?: string;
  rate?: number;
  onBoundary?: (boundary: TtsBoundary) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function listVoices(): SpeechSynthesisVoice[] {
  return isTtsSupported() ? window.speechSynthesis.getVoices() : [];
}

/**
 * Habla un bloque sin interrumpir el anterior: el navegador encola las
 * utterances para no recortar la última palabra ni perder la primera.
 * Quien cambia de fragmento decide cuándo cancelar.
 */
export function speakText(options: SpeakOptions): TtsSession | undefined {
  if (!isTtsSupported()) {
    options.onError?.('Este navegador no ofrece voz local');
    return undefined;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(options.text);
    const voice = listVoices().find((candidate) => candidate.voiceURI === options.voiceURI);
    if (voice) utterance.voice = voice;
    if (options.lang) utterance.lang = options.lang;
    utterance.rate = Math.max(0.1, options.rate ?? 1);

    utterance.onboundary = (event) => {
      if (event.name && event.name !== 'word') return;
      const prefix = options.text.slice(0, event.charIndex).trim();
      const wordIndex = prefix ? prefix.split(/\s+/).filter(Boolean).length : 0;
      options.onBoundary?.({ wordIndex, charIndex: event.charIndex });
    };
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = (event) => {
      const reason = event.error || 'Error de síntesis';
      if (EXPECTED_TTS_ERRORS.has(reason)) return;
      options.onError?.(reason);
    };

    window.speechSynthesis.speak(utterance);
    return {
      cancel: () => window.speechSynthesis.cancel(),
      pause: () => window.speechSynthesis.pause(),
      resume: () => window.speechSynthesis.resume(),
    };
  } catch (error) {
    options.onError?.(error instanceof Error ? error.message : 'No se pudo iniciar la voz');
    return undefined;
  }
}
