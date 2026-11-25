import { useEffect, useRef } from 'react';
import { getTextDuration } from '@/core/player/duration';
import type { PlayerClip } from '@/core/player/state';
import type { PlaybackState } from '@/types';
import { getSpeechRate } from './rate';
import { isNativeAudioAvailable, nativeAudio } from './nativeAudio';

interface UseNativeAudioOptions {
  enabled: boolean;
  clips: PlayerClip[];
  clip?: PlayerClip;
  clipIndex: number;
  status: PlaybackState;
  wpm: number;
  speed: number;
  lang: string;
  title?: string;
  onBoundary: (elapsedMs: number) => void;
  onIndexChange: (index: number) => void;
  onStatus: (status: 'playing' | 'paused') => void;
  onEnded: () => void;
  onError: (message: string) => void;
}

/** Sincroniza el reproductor web con el servicio nativo y sus eventos. */
export function useNativeAudio({
  enabled,
  clips,
  clip,
  clipIndex,
  status,
  wpm,
  speed,
  lang,
  title,
  onBoundary,
  onIndexChange,
  onStatus,
  onEnded,
  onError,
}: UseNativeAudioOptions) {
  const available = isNativeAudioAvailable();
  const activeRef = useRef(false);
  const indexRef = useRef(clipIndex);
  const clipsRef = useRef(clips);
  const statusRef = useRef(status);
  const suppressCommandRef = useRef(false);
  const latestRef = useRef({ clip, wpm, speed, onBoundary, onIndexChange, onStatus, onEnded, onError });
  indexRef.current = clipIndex;
  clipsRef.current = clips;
  statusRef.current = status;
  latestRef.current = { clip, wpm, speed, onBoundary, onIndexChange, onStatus, onEnded, onError };

  useEffect(() => {
    if (!available || !enabled) return;
    let alive = true;
    void nativeAudio.requestPermissions().catch(() => undefined);

    // Registrar una sola vez: los callbacks se leen de latestRef para no
    // recrear los listeners en cada render. Esperamos el registro antes de
    // limpiar para no dejar listeners huérfanos al desmontar.
    const registrations = [
      nativeAudio.addListener('stateChanged', (event) => {
        if (!alive) return;
        const { onIndexChange, onStatus, onEnded } = latestRef.current;
        if (event.index !== indexRef.current) {
          indexRef.current = event.index;
          suppressCommandRef.current = true;
          onIndexChange(event.index);
        }
        const mapped: 'playing' | 'paused' | undefined =
          event.status === 'playing' || event.status === 'paused' ? event.status : undefined;
        if (mapped && mapped !== statusRef.current) {
          suppressCommandRef.current = true;
          onStatus(mapped);
        }
        if (event.status === 'ended' && activeRef.current) onEnded();
      }),
      nativeAudio.addListener('boundary', (event) => {
        if (!alive || event.index !== indexRef.current) return;
        const { clip, wpm, speed, onBoundary } = latestRef.current;
        const activeClip = clipsRef.current[event.index] ?? clip;
        if (!activeClip) return;
        const duration = getTextDuration(
          activeClip.wordCount,
          wpm,
          speed,
          activeClip.block.type === 'text' && activeClip.block.heading === true,
        );
        onBoundary((event.wordIndex * duration) / Math.max(1, activeClip.wordCount));
      }),
      nativeAudio.addListener('error', (event) => {
        if (alive) latestRef.current.onError(event.message);
      }),
    ];

    return () => {
      alive = false;
      void Promise.allSettled(registrations).then((results) => {
        for (const result of results) {
          if (result.status === 'fulfilled') {
            void result.value.remove().catch(() => undefined);
          }
        }
      });
    };
  }, [available, enabled]);

  useEffect(() => {
    if (!available || !enabled) return;
    const entries = clips
      .map((item, index) => ({ text: item.text, index }))
      .filter((item) => item.text.trim().length > 0);
    void nativeAudio
      .configure({
        chunks: entries.map((item) => item.text),
        clipIndices: entries.map((item) => item.index),
        title: title ?? 'Leeto',
        subtitle: '',
        index: clipIndex,
        rate: getSpeechRate(wpm, speed),
        lang,
      })
      .catch(() => undefined);
    // clipIndex se lee aquí solo al configurar un libro nuevo; los saltos se
    // envían con play() y no deben reiniciar la cola de voz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, enabled, clips, wpm, speed, lang, title]);

  useEffect(() => {
    if (!available || enabled) return;
    void nativeAudio.stop().catch(() => undefined);
  }, [available, enabled]);

  useEffect(() => {
    if (!available) return;
    return () => {
      void nativeAudio.stop().catch(() => undefined);
    };
  }, [available]);

  useEffect(() => {
    if (!available || !enabled) return;
    if (suppressCommandRef.current) {
      suppressCommandRef.current = false;
      return;
    }
    if (status === 'playing') {
      activeRef.current = true;
      void nativeAudio.play(clipIndex).catch(() => undefined);
    } else if (activeRef.current) {
      activeRef.current = false;
      void nativeAudio.pause().catch(() => undefined);
    }
  }, [available, enabled, status, clipIndex]);
}
