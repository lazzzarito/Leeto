import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { progressRepo } from '@/core/db/repositories';
import { useSettings } from '@/core/db/settings';
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
import { useBookProgress } from '@/hooks/useLibrary';
import type { LeetoBook } from '@/types';

const SAVE_DEBOUNCE_MS = 300;

/** Motor del lector: reloj único, sincronización con ajustes y progreso persistido. */
export function usePlayer(book?: LeetoBook) {
  const settings = useSettings();
  const bookId = book?.id;
  const totalWordCount = book?.totalWordCount ?? 0;
  const progress = useBookProgress(bookId ?? '');
  const [state, dispatch] = useReducer(playerReducer, undefined, createInitialState);
  const clips = useMemo(() => buildClips(book?.chapters ?? []), [book?.chapters]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSavedRef = useRef<string | undefined>(undefined);
  const appliedProgressAtRef = useRef<number | undefined>(undefined);
  const loadedBookIdRef = useRef<string | undefined>(undefined);

  const flush = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    const current = stateRef.current;
    const clip = current.clips[current.clipIndex];
    // Nunca escribas el clip de otro libro con el id del libro actual.
    if (!clip || !bookId || loadedBookIdRef.current !== bookId) return;
    lastSavedRef.current = `${clip.block.id}:${clip.segmentIndex}`;
    void progressRepo.put({
      bookId,
      chapterIndex: clip.chapterIndex,
      blockId: clip.block.id,
      segmentIndex: clip.segmentIndex,
      percentage: getProgressPercentage(current, totalWordCount),
      updatedAt: Date.now(),
      deviceId: settings.deviceId,
    });
    notifyLocalSyncChange();
  }, [bookId, totalWordCount, settings.deviceId]);

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
    const saved = progress?.bookId === bookId ? progress : undefined;
    const switchingBook = loadedBookIdRef.current !== bookId;
    if (switchingBook) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
      lastSavedRef.current = undefined;
      appliedProgressAtRef.current = undefined;
      loadedBookIdRef.current = bookId;
    } else if (stateRef.current.status === 'playing') {
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
    dispatch({
      type: 'load',
      clips,
      wpm: currentSettings.wpm,
      speed: currentSettings.playbackSpeed,
      imageDurationMs: currentSettings.imageDurationMs ?? 6000,
      clipIndex,
      elapsedMs: 0,
      status: 'paused',
    });
  }, [bookId, clips, progress?.bookId, progress?.blockId, progress?.segmentIndex, progress?.updatedAt]);

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

  useEffect(() => {
    scheduleSave();
  }, [state.clipIndex, scheduleSave]);

  useEffect(() => {
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
