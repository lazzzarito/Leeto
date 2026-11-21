import { useEffect, useRef, useState } from 'react';
import { getWordDuration } from '@/core/player/duration';
import type { PlayerClip } from '@/core/player/state';
import type { PlaybackState } from '@/types';
import { isTtsSupported, listVoices, speakText, type TtsSession } from './driver';

interface UseTtsOptions {
  enabled: boolean;
  clip?: PlayerClip;
  status: PlaybackState;
  wpm: number;
  speed: number;
  voiceURI?: string;
  onBoundary: (elapsedMs: number) => void;
  onError?: (message: string) => void;
}

/** Voz opcional: alinea onboundary con el playhead; falla sin detener el temporizador. */
export function useTts({
  enabled,
  clip,
  status,
  wpm,
  speed,
  voiceURI,
  onBoundary,
  onError,
}: UseTtsOptions) {
  const sessionRef = useRef<TtsSession>();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listVoices());
  const [lastError, setLastError] = useState<string>();

  useEffect(() => {
    if (!isTtsSupported()) return;
    const update = () => setVoices(listVoices());
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);

  useEffect(() => {
    if (!enabled || !clip || clip.block.type !== 'text' || status !== 'playing') return;

    const wordMs = getWordDuration(clip.wordCount, wpm, speed);
    const session = speakText({
      text: clip.text,
      voiceURI,
      rate: speed,
      onBoundary: ({ wordIndex }) => onBoundary(wordIndex * wordMs),
      onError: (message) => {
        setLastError(message);
        onError?.(message);
      },
    });
    sessionRef.current = session;

    return () => {
      session?.cancel();
      sessionRef.current = undefined;
    };
  }, [enabled, clip?.key, status, wpm, speed, voiceURI, onBoundary, onError]);

  return { supported: isTtsSupported(), voices, lastError };
}
