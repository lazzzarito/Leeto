import { useEffect, useRef } from 'react';
import { getTextDuration } from '@/core/player/duration';
import type { PlayerClip } from '@/core/player/state';
import type { PlaybackState } from '@/types';
import { getSpeechRate } from './rate';
import { isNativeAudioAvailable, nativeAudio } from './nativeAudio';

interface UseNativeAudioOptions {
  enabled: boolean;
  settingsLoaded?: boolean;
  bookId?: string;
  clips: PlayerClip[];
  clip?: PlayerClip;
  clipIndex: number;
  status: PlaybackState;
  wpm: number;
  speed: number;
  lang: string;
  title?: string;
  coverDataUrl?: string | null;
  onBoundary: (elapsedMs: number) => void;
  onIndexChange: (index: number) => void;
  onStatus: (status: 'playing' | 'paused') => void;
  onEnded: () => void;
  onError: (message: string) => void;
}

interface Suppression {
  status: 'playing' | 'paused';
  clipIndex: number;
}

/** Sincroniza el reproductor web con el servicio nativo y sus eventos. */
export function useNativeAudio({
  enabled,
  settingsLoaded = true,
  bookId,
  clips,
  clip,
  clipIndex,
  status,
  wpm,
  speed,
  lang,
  title,
  coverDataUrl,
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
  const suppressRef = useRef<Suppression | undefined>(undefined);
  const permissionWarnedRef = useRef(false);
  const wasEnabledRef = useRef(enabled);
  const latestRef = useRef({ clip, wpm, speed, onBoundary, onIndexChange, onStatus, onEnded, onError });
  const bookIdRef = useRef(bookId);
  indexRef.current = clipIndex;
  clipsRef.current = clips;
  statusRef.current = status;
  latestRef.current = { clip, wpm, speed, onBoundary, onIndexChange, onStatus, onEnded, onError };
  bookIdRef.current = bookId;

  // Los listeners se registran una sola vez: durante la hidratación de ajustes
  // un `enabled: false` transitorio no debe desconectarlos ni detener la voz.
  useEffect(() => {
    if (!available) return;
    let alive = true;
    void nativeAudio
      .requestPermissions()
      .then((result) => {
        const permission = result?.notifications;
        if (
          permission === 'denied' &&
          !permissionWarnedRef.current
        ) {
          permissionWarnedRef.current = true;
          latestRef.current.onError(
            'Notificaciones desactivadas: activa el permiso para ver los controles de audio',
          );
        }
      })
      .catch(() => undefined);

    const registrations = [
      nativeAudio.addListener('stateChanged', (event) => {
        if (!alive) return;
        const { onIndexChange, onStatus, onEnded } = latestRef.current;
        if (event.index !== indexRef.current) {
          indexRef.current = event.index;
          onIndexChange(event.index);
        }
        if (event.status === 'ended') {
          if (activeRef.current) {
            activeRef.current = false;
            onEnded();
          }
          return;
        }
        const mapped: 'playing' | 'paused' | undefined =
          event.status === 'playing' || event.status === 'paused'
            ? event.status
            : event.status === 'stopped' || event.status === 'error'
              ? 'paused'
              : undefined;
        if (mapped && mapped !== statusRef.current) {
          // Solo suprimimos el comando que este mismo evento va a provocar.
          suppressRef.current = { status: mapped, clipIndex: indexRef.current };
          onStatus(mapped);
        }
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
  }, [available]);

  useEffect(() => {
    if (!available || !enabled) return;
    const entries = clips
      .map((item, index) => ({ text: item.text, index }))
      .filter((item) => item.text.trim().length > 0);
    // Sin clips no hay contexto de libro: reconfigurar aquí borraría el título
    // y el idioma de la notificación mientras la voz sigue sonando.
    if (entries.length === 0) return;
    void nativeAudio
      .configure({
        chunks: entries.map((item) => item.text),
        clipIndices: entries.map((item) => item.index),
        title: title ?? 'Leeto',
        subtitle: '',
        index: clipIndex,
        rate: getSpeechRate(wpm, speed),
        lang,
        bookId: bookIdRef.current,
      })
      .catch(() => undefined);
    // clipIndex se lee aquí solo al configurar un libro nuevo; los saltos se
    // envían con play() y no deben reiniciar la cola de voz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, enabled, clips, wpm, speed, lang, title, bookId]);

  // `undefined` = aún no hay libro: no tocamos la portada que el servicio ya
  // tiene, para que sobreviva a cambios de Activity.
  useEffect(() => {
    if (!available || coverDataUrl === undefined) return;
    void nativeAudio.setCover(coverDataUrl ?? undefined).catch(() => undefined);
  }, [available, coverDataUrl]);

  // Solo una transición real de encendido a apagado detiene la voz. El valor
  // inicial `false` de IndexedDB no cuenta como acción del usuario.
  useEffect(() => {
    if (!available || !settingsLoaded) return;
    if (wasEnabledRef.current && !enabled) void nativeAudio.stop().catch(() => undefined);
    wasEnabledRef.current = enabled;
  }, [available, enabled, settingsLoaded]);

  useEffect(() => {
    if (!available || !enabled) return;
    const suppression = suppressRef.current;
    if (suppression && suppression.status === status && suppression.clipIndex === clipIndex) {
      suppressRef.current = undefined;
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
