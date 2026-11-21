import { describe, expect, it } from 'vitest';
import type { LeetoChapter } from '@/types';
import { getBlockDuration, getImageDuration } from './duration';
import {
  buildClips,
  createInitialState,
  getActiveWordIndex,
  getClipDuration,
  getProgressPercentage,
  playerReducer,
  type PlayerState,
} from './state';

const chapters: LeetoChapter[] = [
  {
    index: 0,
    title: 'Uno',
    blocks: [
      { id: 'b1', type: 'text', content: 'a '.repeat(100).trim(), wordCount: 100 },
      { id: 'b2', type: 'image', assetId: 'i1' },
    ],
  },
  {
    index: 1,
    title: 'Dos',
    blocks: [{ id: 'b3', type: 'text', content: 'c '.repeat(40).trim(), wordCount: 40 }],
  },
];

function loaded(): PlayerState {
  return playerReducer(createInitialState(), {
    type: 'load',
    clips: buildClips(chapters),
    wpm: 240,
    speed: 1,
    imageDurationMs: 6000,
  });
}

describe('duración del reproductor', () => {
  it('calcula duración de texto desde palabras, PPM y velocidad', () => {
    expect(getBlockDuration(100, 240, 1)).toBe(25_000);
    expect(getBlockDuration(100, 240, 2)).toBe(12_500);
    expect(getBlockDuration(100, 0, 1)).toBe(6_000_000);
  });

  it('ajusta la duración de imágenes por velocidad', () => {
    expect(getImageDuration(6000, 1)).toBe(6000);
    expect(getImageDuration(6000, 1.5)).toBe(4000);
  });
});

describe('máquina de estados del reproductor', () => {
  it('carga en pausa, reproduce y congela el playhead al pausar', () => {
    const initial = loaded();
    expect(initial.status).toBe('paused');
    expect(initial.clips).toHaveLength(3);
    expect(getClipDuration(initial)).toBe(25_000);

    const playing = playerReducer(initial, { type: 'play' });
    expect(playing.status).toBe('playing');
    const ticked = playerReducer(playing, { type: 'tick', deltaMs: 5000 });
    expect(ticked.elapsedMs).toBe(5000);
    expect(getActiveWordIndex(ticked)).toBe(20);

    const paused = playerReducer(ticked, { type: 'pause' });
    expect(playerReducer(paused, { type: 'tick', deltaMs: 5000 }).elapsedMs).toBe(5000);
  });

  it('avanza de clip acumulando el excedente del tick', () => {
    const playing = playerReducer(loaded(), { type: 'play' });
    const ticked = playerReducer(playing, { type: 'tick', deltaMs: 26_000 });
    expect(ticked.clipIndex).toBe(1);
    expect(ticked.elapsedMs).toBe(1000);
    expect(getClipDuration(ticked)).toBe(6000);
  });

  it('termina al agotar el último clip', () => {
    const state = { ...loaded(), clipIndex: 2, status: 'playing' as const, elapsedMs: 9500 };
    const ended = playerReducer(state, { type: 'tick', deltaMs: 1000 });
    expect(ended.status).toBe('ended');
    expect(ended.clipIndex).toBe(2);
    expect(ended.elapsedMs).toBe(10_000);
  });

  it('recalcula la duración al cambiar velocidad sin perder la posición relativa', () => {
    const state = { ...loaded(), status: 'playing' as const, elapsedMs: 12_500 };
    const faster = playerReducer(state, { type: 'setSpeed', speed: 2 });
    expect(faster.status).toBe('playing');
    expect(getClipDuration(faster)).toBe(12_500);
    expect(faster.elapsedMs).toBe(6250);
    expect(getClipDuration(faster) - faster.elapsedMs).toBe(6250);

    const slowerWpm = playerReducer(faster, { type: 'setWpm', wpm: 120 });
    expect(slowerWpm.elapsedMs).toBe(12_500);
    expect(getClipDuration(slowerWpm)).toBe(25_000);
  });

  it('seek y navegación manual pausan y sitúan el playhead', () => {
    const state = loaded();
    const seeked = playerReducer(state, { type: 'seek', clipIndex: 2, elapsedMs: 2000 });
    expect(seeked).toMatchObject({ status: 'paused', clipIndex: 2, elapsedMs: 2000 });

    const next = playerReducer(seeked, { type: 'next' });
    expect(next).toMatchObject({ clipIndex: 2, elapsedMs: 0 });
    const previous = playerReducer(next, { type: 'previous' });
    expect(previous).toMatchObject({ clipIndex: 1, elapsedMs: 0 });
  });

  it('align conserva el estado y calcula el porcentaje global', () => {
    const playing = playerReducer(loaded(), { type: 'play' });
    const aligned = playerReducer(playing, { type: 'align', elapsedMs: 6250 });
    expect(aligned.status).toBe('playing');
    expect(getActiveWordIndex(aligned)).toBe(25);
    expect(getProgressPercentage(aligned, 140)).toBeCloseTo(17.9, 1);
  });

  it('reporta errores y se reanuda desde el inicio tras ended', () => {
    const failed = playerReducer(loaded(), { type: 'error', message: 'sin voz' });
    expect(failed.status).toBe('error');
    expect(failed.error).toBe('sin voz');

    const ended: PlayerState = { ...loaded(), status: 'ended' };
    const replay = playerReducer(ended, { type: 'play' });
    expect(replay).toMatchObject({ status: 'playing', clipIndex: 0, elapsedMs: 0 });
  });
});
