import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { booksRepo, progressRepo } from '@/core/db/repositories';
import { useSettings } from '@/core/db/settings';
import { resolveReadingStatus } from '@/core/library/views';
import { createPlayerClock } from '@/core/player/clock';
import { saveQuoteForClip } from '@/core/player/quotes';
import { notifyLocalSyncChange } from '@/core/sync/scheduler';
import {
  buildClips,
  createInitialState,
  getActiveWordIndex,
  getProgressPercentage,
  playerReducer,
} from '@/core/player/state';
import { findClipIndex } from '@/core/player/resolve';
import { useBookProgressState } from '@/hooks/useLibrary';
import type { LeetoBook, ReadingStatus } from '@/types';

const SAVE_DEBOUNCE_MS = 300;

/** Motor del lector: reloj único, sincronización con ajustes y progreso persistido. */
export function usePlayer(book?: LeetoBook) {
  const settings = useSettings();
  const bookId = book?.id;
  const totalWordCount = book?.totalWordCount ?? 0;
  const { progress, loaded: progressLoaded } = useBookProgressState(bookId);
  const [state, dispatch] = useReducer(playerReducer, undefined, createInitialState);
  const clips = useMemo(() => buildClips(book?.chapters ?? []), [book?.chapters]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const bookIdRef = useRef(bookId);
  bookIdRef.current = bookId;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSavedRef = useRef<string | undefined>(undefined);
  const appliedProgressAtRef = useRef<number | undefined>(undefined);
  const loadedBookIdRef = useRef<string | undefined>(undefined);
  const hydratedBookIdRef = useRef<string | undefined>(undefined);
  // El reproductor es global: al salir del lector `bookId` desaparece, pero la
  // escritura pendiente debe seguir apuntando al libro que se estaba leyendo.
  const saveBookIdRef = useRef<string | undefined>(undefined);
  const loadedWordCountRef = useRef(totalWordCount);
  const explicitStatusRef = useRef<ReadingStatus | undefined>(undefined);
  const hasPlayedRef = useRef(false);

  /**
   * Escribe la posición actual. Conserva el estado explícito del libro para que
   * abrir el lector nunca degrade un "Marcar como leído" a "Leyendo".
   */
  const flush = useCallback((targetBookId?: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    const id = targetBookId ?? saveBookIdRef.current ?? bookIdRef.current;
    const current = stateRef.current;
    const clip = current.clips[current.clipIndex];
    if (!clip || !id) return;
    // Nunca escribas el clip de otro libro con el id del libro actual.
    if (loadedBookIdRef.current !== id || hydratedBookIdRef.current !== id) return;

    const percentage = getProgressPercentage(current, loadedWordCountRef.current);
    // El porcentaje es una estimación: un libro terminado sigue terminado aunque
    // se vuelva a abrir y el playhead quede antes del último bloque.
    const status = resolveReadingStatus(explicitStatusRef.current, percentage);

    lastSavedRef.current = `${clip.block.id}:${clip.segmentIndex}`;
    void (async () => {
      // Un borrado/marcado como no leído en otra pestaña deja un tombstone:
      // sobrescribirlo aquí lo resucitaba en el siguiente sync.
      const [book, existing] = await Promise.all([
        booksRepo.get(id),
        progressRepo.get(id),
      ]);
      if (!book || existing?.deletedAt) return;
      await progressRepo.put({
        bookId: id,
        chapterIndex: clip.chapterIndex,
        blockId: clip.block.id,
        segmentIndex: clip.segmentIndex,
        percentage,
        elapsedMs: Math.max(0, Math.round(current.elapsedMs)),
        updatedAt: Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1),
        deviceId: settingsRef.current.deviceId,
        ...(status ? { status } : {}),
      });
    })()
      .then(() => {
        // Avisar después de escribir evita que el sync tome una foto sin este cambio.
        notifyLocalSyncChange();
      })
      .catch(() => {
        // Si falla IDB, permitir reintentar en el siguiente flush.
        lastSavedRef.current = undefined;
      });
  }, []);

  const scheduleSave = useCallback(() => {
    const current = stateRef.current;
    const clip = current.clips[current.clipIndex];
    if (!clip) return;
    const key = `${clip.block.id}:${clip.segmentIndex}`;
    // Una rehidratación del mismo clip no debe provocar otra escritura.
    if (lastSavedRef.current === key) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = undefined;
      flush();
    }, SAVE_DEBOUNCE_MS);
  }, [flush]);

  // Restaura el subtítulo guardado. Es idempotente: una escritura propia nunca
  // debe recargar el clip (eso reiniciaba el playhead y cortaba la voz).
  useEffect(() => {
    if (!bookId) {
      // Salir del lector no puede perder la posición: el reproductor sigue vivo.
      if (saveBookIdRef.current) flush(saveBookIdRef.current);
      // Si la voz sigue sonando, los eventos de avance del servicio deben seguir
      // escribiendo con el id del libro que se está leyendo.
      if (stateRef.current.status === 'playing') return;
      loadedBookIdRef.current = undefined;
      hydratedBookIdRef.current = undefined;
      saveBookIdRef.current = undefined;
      hasPlayedRef.current = false;
      return;
    }
    // IndexedDB todavía no ha respondido: escribir un 0 % aquí sobrescribiría
    // el progreso real del libro en la siguiente renderización.
    if (!progressLoaded) return;

    const saved = progress?.bookId === bookId ? progress : undefined;
    const switchingBook = loadedBookIdRef.current !== bookId;
    if (switchingBook) {
      // Vaciar la escritura pendiente del libro anterior antes de cambiar refs.
      if (loadedBookIdRef.current) flush(loadedBookIdRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
      lastSavedRef.current = undefined;
      appliedProgressAtRef.current = undefined;
      hasPlayedRef.current = false;
      explicitStatusRef.current = undefined;
      loadedBookIdRef.current = bookId;
    }
    // El estado explícito se conserva incluso si un cambio remoto llega mientras
    // se reproduce; antes se leía después del `return` y se perdía.
    if (saved?.status) explicitStatusRef.current = saved.status;
    if (!switchingBook && stateRef.current.status === 'playing') {
      // Un cambio remoto mientras se reproduce no debe mover el playhead ni cortar la voz.
      return;
    }

    const savedKey = saved ? `${saved.blockId}:${saved.segmentIndex ?? 0}` : 'new';
    if (!switchingBook && saved && lastSavedRef.current === savedKey) return;
    if (!switchingBook && saved && appliedProgressAtRef.current === saved.updatedAt) return;
    const clipIndex = saved ? findClipIndex(clips, saved) : 0;
    const current = stateRef.current;
    if (!switchingBook && current.clips.length > 0 && current.clipIndex === clipIndex) return;
    const currentSettings = settingsRef.current;
    appliedProgressAtRef.current = saved?.updatedAt;
    lastSavedRef.current = savedKey;
    loadedWordCountRef.current = totalWordCount;
    hydratedBookIdRef.current = bookId;
    saveBookIdRef.current = bookId;
    dispatch({
      type: 'load',
      clips,
      wpm: currentSettings.wpm,
      speed: currentSettings.playbackSpeed,
      imageDurationMs: currentSettings.imageDurationMs ?? 6000,
      clipIndex,
      elapsedMs: saved?.elapsedMs ?? 0,
      status: 'paused',
    });
  }, [
    bookId,
    progressLoaded,
    progress?.bookId,
    progress?.blockId,
    progress?.segmentIndex,
    progress?.elapsedMs,
    progress?.status,
    progress?.updatedAt,
    clips,
    totalWordCount,
    flush,
  ]);

  useEffect(() => {
    dispatch({ type: 'setWpm', wpm: settings.wpm });
  }, [settings.wpm]);

  useEffect(() => {
    dispatch({ type: 'setSpeed', speed: settings.playbackSpeed });
  }, [settings.playbackSpeed]);

  useEffect(() => {
    dispatch({ type: 'setImageDuration', imageDurationMs: settings.imageDurationMs ?? 6000 });
  }, [settings.imageDurationMs]);

  useEffect(() => {
    if (state.status !== 'playing') return;
    const clock = createPlayerClock((deltaMs) => dispatch({ type: 'tick', deltaMs }));
    clock.start();
    return () => clock.stop();
  }, [state.status]);

  // Latido periódico: si el proceso muere antes del siguiente cambio de clip,
  // la posición audible más reciente ya está persistida.
  useEffect(() => {
    if (state.status !== 'playing' || !hasPlayedRef.current) return;
    const timer = window.setInterval(() => flush(), 8000);
    return () => {
      window.clearInterval(timer);
      flush();
    };
  }, [flush, state.status]);

  useEffect(() => {
    if (state.status === 'playing') hasPlayedRef.current = true;
  }, [state.status]);

  useEffect(() => {
    scheduleSave();
  }, [state.clipIndex, scheduleSave]);

  useEffect(() => {
    // La carga programada del lector no cuenta como avance: no debe escribir.
    if (!hasPlayedRef.current) return;
    if (['paused', 'ended', 'error'].includes(state.status)) flush();
  }, [state.status, flush]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      // Solo sigue en segundo plano si la persona activó la voz explícitamente.
      if (stateRef.current.status === 'playing' && !settingsRef.current.ttsEnabled) {
        dispatch({ type: 'pause' });
      }
      flush();
    };
    const onPageHide = () => {
      if (stateRef.current.status === 'playing' && !settingsRef.current.ttsEnabled) {
        dispatch({ type: 'pause' });
      }
      flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      flush();
    };
  }, [flush]);

  const play = useCallback(() => dispatch({ type: 'play' }), []);
  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const toggle = useCallback(() => {
    dispatch({ type: stateRef.current.status === 'playing' ? 'pause' : 'play' });
  }, []);
  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const previous = useCallback(() => dispatch({ type: 'previous' }), []);
  const seekTo = useCallback((clipIndex: number, elapsedMs = 0) => {
    dispatch({ type: 'seek', clipIndex, elapsedMs });
  }, []);
  const alignPlayhead = useCallback((elapsedMs: number) => {
    dispatch({ type: 'align', elapsedMs });
  }, []);
  const saveQuote = useCallback(async () => {
    if (!book || loadedBookIdRef.current !== book.id) return undefined;
    const clip = stateRef.current.clips[stateRef.current.clipIndex];
    const quote = clip ? await saveQuoteForClip(book, clip) : undefined;
    if (quote) notifyLocalSyncChange();
    return quote;
  }, [book]);

  const clip = state.clips[state.clipIndex];
  const chapter = book?.chapters[clip?.chapterIndex ?? 0];

  return {
    state,
    clip,
    chapter,
    activeWordIndex: getActiveWordIndex(state),
    percentage: book ? getProgressPercentage(state, book.totalWordCount) : 0,
    play,
    pause,
    toggle,
    next,
    previous,
    seekTo,
    alignPlayhead,
    saveQuote,
    flush,
  };
}
