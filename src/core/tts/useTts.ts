import { useEffect, useRef, useState } from 'react';
import { getTextDuration } from '@/core/player/duration';
import type { PlayerClip } from '@/core/player/state';
import type { PlaybackState } from '@/types';
import { isTtsSupported, listVoices, speakText, type TtsSession } from './driver';
import { getSpeechRate } from './rate';

interface UseTtsOptions {
  enabled: boolean;
  clip?: PlayerClip;
  clipIndex: number;
  status: PlaybackState;
  wpm: number;
  speed: number;
  voiceURI?: string;
  lang?: string;
  onBoundary: (elapsedMs: number) => void;
  onError?: (message: string) => void;
}

/** Voz opcional: sigue al playhead y encola fragmentos para no recortarlos. */
export function useTts({
  enabled,
  clip,
  clipIndex,
  status,
  wpm,
  speed,
  voiceURI,
  lang,
  onBoundary,
  onError,
}: UseTtsOptions) {
  const sessionRef = useRef<TtsSession | undefined>(undefined);
  const currentKeyRef = useRef<string | undefined>(undefined);
  const spokenRef = useRef<{ index: number } | undefined>(undefined);
  const pausedRef = useRef(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listVoices());
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isTtsSupported()) return;
    const update = () => setVoices(listVoices());
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);

  useEffect(() => {
    currentKeyRef.current = clip?.key;
    const active = enabled && status === 'playing' && Boolean(clip);
    const sameClip = spokenRef.current?.index === clipIndex && Boolean(sessionRef.current);

    if (!enabled) {
      sessionRef.current?.cancel();
      pausedRef.current = false;
      return;
    }

    if (!active) {
      if (status === 'paused' && sameClip) sessionRef.current?.pause();
      else sessionRef.current?.cancel();
      pausedRef.current = status === 'paused' && sameClip;
      return;
    }

    if (sameClip) {
      if (pausedRef.current) sessionRef.current?.resume();
      pausedRef.current = false;
      return;
    }

    sessionRef.current?.cancel();
    pausedRef.current = false;
    if (!clip || clip.block.type !== 'text') return;

    spokenRef.current = { index: clipIndex };
    const key = clip.key;
    const heading = clip.block.type === 'text' && clip.block.heading === true;
    const wordMs =
      getTextDuration(clip.wordCount, wpm, speed, heading) / Math.max(1, clip.wordCount);
    const session = speakText({
      text: clip.text,
      voiceURI,
      lang,
      rate: getSpeechRate(wpm, speed),
      onBoundary: ({ wordIndex }) => {
        if (currentKeyRef.current !== key) return;
        onBoundary(wordIndex * wordMs);
      },
      onError: (message) => {
        if (currentKeyRef.current !== key) return;
        setLastError(message);
        onError?.(message);
      },
    });
    sessionRef.current = session;
  }, [enabled, clip?.key, clipIndex, status, wpm, speed, voiceURI, lang, onBoundary, onError]);

  useEffect(() => () => sessionRef.current?.cancel(), []);

  return { supported: isTtsSupported(), voices, lastError };
}
