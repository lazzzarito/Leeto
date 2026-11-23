import { estimatePercentage } from '@/lib/time';
import type { LeetoBlock, LeetoChapter, PlaybackState } from '@/types';
import { getImageDuration, getTextDuration } from './duration';
import { splitIntoSegments } from './segment';

export interface PlayerClip {
  key: string;
  chapterIndex: number;
  blockIndex: number;
  block: LeetoBlock;
  segmentIndex: number;
  segmentCount: number;
  /** Texto del subtítulo; vacío en imágenes. */
  text: string;
  wordCount: number;
}

export interface PlayerState {
  status: PlaybackState;
  clips: PlayerClip[];
  clipIndex: number;
  elapsedMs: number;
  wpm: number;
  speed: number;
  imageDurationMs: number;
  error?: string;
}

export type PlayerAction =
  | {
      type: 'load';
      clips: PlayerClip[];
      wpm: number;
      speed: number;
      imageDurationMs: number;
      clipIndex?: number;
      elapsedMs?: number;
      status?: PlaybackState;
    }
  | { type: 'ready' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seeking' }
  | { type: 'tick'; deltaMs: number }
  | { type: 'seek'; clipIndex: number; elapsedMs?: number }
  | { type: 'align'; elapsedMs: number }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'setSpeed'; speed: number }
  | { type: 'setWpm'; wpm: number }
  | { type: 'setImageDuration'; imageDurationMs: number }
  | { type: 'ended' }
  | { type: 'error'; message: string };

export function createInitialState(): PlayerState {
  return {
    status: 'idle',
    clips: [],
    clipIndex: 0,
    elapsedMs: 0,
    wpm: 240,
    speed: 1,
    imageDurationMs: 6000,
  };
}

export function buildClips(chapters: LeetoChapter[]): PlayerClip[] {
  return chapters.flatMap((chapter) =>
    chapter.blocks.flatMap((block, blockIndex) => {
      const base = {
        chapterIndex: chapter.index,
        blockIndex,
        block,
      };
      if (block.type === 'image') {
        return [
          {
            ...base,
            key: `${chapter.index}:${block.id}:s0`,
            segmentIndex: 0,
            segmentCount: 1,
            text: '',
            wordCount: 0,
          },
        ];
      }

      const segments = splitIntoSegments(block.content);
      return segments.map((text, segmentIndex) => ({
        ...base,
        key: `${chapter.index}:${block.id}:s${segmentIndex}`,
        segmentIndex,
        segmentCount: segments.length,
        text,
        wordCount: text.split(/\s+/).filter(Boolean).length,
      }));
    }),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getClipDuration(state: PlayerState, clipIndex = state.clipIndex): number {
  const clip = state.clips[clipIndex];
  if (!clip) return 0;
  if (clip.block.type === 'image') return getImageDuration(state.imageDurationMs, state.speed);
  return getTextDuration(
    clip.wordCount,
    state.wpm,
    state.speed,
    clip.block.type === 'text' && clip.block.heading === true,
  );
}

/** Índice de palabra activo (0-based) dentro del clip actual; -1 si no hay texto. */
export function getActiveWordIndex(state: PlayerState): number {
  const clip = state.clips[state.clipIndex];
  if (!clip || clip.block.type !== 'text') return -1;
  const wordCount = clip.wordCount;
  if (wordCount <= 0) return 0;
  const duration = getClipDuration(state);
  if (duration <= 0) return 0;
  return clamp(Math.floor((state.elapsedMs / duration) * wordCount), 0, wordCount - 1);
}

/** Porcentaje global leído a partir de los clips consumidos y el parcial actual. */
export function getProgressPercentage(state: PlayerState, totalWordCount: number): number {
  const clip = state.clips[state.clipIndex];
  if (!clip) return 0;
  const duration = getClipDuration(state);
  const fraction = duration > 0 ? clamp(state.elapsedMs / duration, 0, 1) : 0;

  // Libros sin texto (CBZ): el progreso avanza por páginas, no por palabras.
  if (totalWordCount <= 0) {
    const percentage = ((state.clipIndex + fraction) / state.clips.length) * 100;
    return Math.round(clamp(percentage, 0, 100) * 10) / 10;
  }

  const wordsBefore = state.clips
    .slice(0, state.clipIndex)
    .reduce((sum, item) => sum + item.wordCount, 0);
  const currentWords = clip.wordCount * fraction;
  return estimatePercentage(totalWordCount, wordsBefore + currentWords);
}

/** Cambia PPM o velocidad conservando la posición relativa dentro del clip. */
function rescale(state: PlayerState, patch: Partial<PlayerState>): PlayerState {
  const oldDuration = getClipDuration(state);
  const next = { ...state, ...patch };
  const newDuration = getClipDuration(next);
  const fraction = oldDuration > 0 ? clamp(state.elapsedMs / oldDuration, 0, 1) : 0;
  return { ...next, elapsedMs: fraction * newDuration };
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'load': {
      const clipIndex = clamp(action.clipIndex ?? 0, 0, Math.max(0, action.clips.length - 1));
      const next: PlayerState = {
        ...state,
        clips: action.clips,
        wpm: action.wpm,
        speed: action.speed,
        imageDurationMs: action.imageDurationMs,
        clipIndex,
        elapsedMs: action.elapsedMs ?? 0,
        error: undefined,
      };
      return {
        ...next,
        elapsedMs: clamp(next.elapsedMs, 0, getClipDuration(next)),
        status:
          action.status ??
          (action.clips.length > 0 ? 'paused' : 'idle'),
      };
    }
    case 'ready':
      return state.status === 'loading' ? { ...state, status: 'paused' } : state;
    case 'play':
      if (state.status === 'error' || state.clips.length === 0) return state;
      if (state.status === 'ended') return { ...state, clipIndex: 0, elapsedMs: 0, status: 'playing' };
      return { ...state, status: 'playing' };
    case 'pause':
      return state.status === 'playing' || state.status === 'seeking'
        ? { ...state, status: 'paused' }
        : state;
    case 'seeking':
      return { ...state, status: 'seeking' };
    case 'tick': {
      if (state.status !== 'playing' || action.deltaMs <= 0) return state;
      let { clipIndex, elapsedMs } = state;
      let remaining = action.deltaMs;
      let next = state;

      while (remaining > 0) {
        const duration = getClipDuration(next, clipIndex);
        if (elapsedMs + remaining < duration) {
          elapsedMs += remaining;
          break;
        }
        if (clipIndex >= next.clips.length - 1) {
          return { ...next, clipIndex, elapsedMs: duration, status: 'ended' };
        }
        remaining -= Math.max(0, duration - elapsedMs);
        clipIndex += 1;
        elapsedMs = 0;
      }

      next = { ...next, clipIndex, elapsedMs };
      return next;
    }
    case 'seek':
      return {
        ...state,
        status: state.status === 'ended' ? 'paused' : state.status,
        clipIndex: clamp(action.clipIndex, 0, Math.max(0, state.clips.length - 1)),
        elapsedMs: Math.max(0, action.elapsedMs ?? 0),
      };
    case 'align':
      return {
        ...state,
        elapsedMs: clamp(action.elapsedMs, 0, getClipDuration(state)),
      };
    case 'next':
      return {
        ...state,
        clipIndex: Math.min(state.clipIndex + 1, Math.max(0, state.clips.length - 1)),
        elapsedMs: 0,
        status: state.status === 'ended' ? 'paused' : state.status,
      };
    case 'previous':
      return {
        ...state,
        clipIndex: Math.max(state.clipIndex - 1, 0),
        elapsedMs: 0,
        status: state.status === 'ended' ? 'paused' : state.status,
      };
    case 'setSpeed':
      return rescale(state, { speed: Math.max(0.1, action.speed) });
    case 'setWpm':
      return rescale(state, { wpm: Math.max(1, action.wpm) });
    case 'setImageDuration':
      return rescale(state, { imageDurationMs: Math.max(500, action.imageDurationMs) });
    case 'ended':
      return { ...state, status: 'ended', elapsedMs: getClipDuration(state) };
    case 'error':
      return { ...state, status: 'error', error: action.message };
  }
}
