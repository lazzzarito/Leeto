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

const words = (count: number, prefix = 'palabra') =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(' ');

const chapters: LeetoChapter[] = [
  {
    index: 0,
    title: 'Uno',
    blocks: [
      { id: 'b1', type: 'text', content: words(20, 'a'), wordCount: 20 },
      { id: 'b2', type: 'image', assetId: 'i1' },
    ],
  },
  {
    index: 1,
    title: 'Dos',
    blocks: [{ id: 'b3', type: 'text', content: words(20, 'c'), wordCount: 20 }],
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

describe('buildClips', () => {
  it('crea un clip por subtítulo manteniendo la referencia al bloque original', () => {
    const content = words(50, 'largo');
    const clips = buildClips([
      {
        index: 0,
        title: 'Largo',
        blocks: [{ id: 'block-50', type: 'text', content, wordCount: 50 }],
      },
    ]);

    expect(clips.length).toBeGreaterThan(2);
    expect(clips[0]).toMatchObject({
      chapterIndex: 0,
      blockIndex: 0,
      segmentIndex: 0,
      segmentCount: clips.length,
    });
    expect(clips[0]?.block.id).toBe('block-50');
    expect(clips.at(-1)?.segmentIndex).toBe(clips.length - 1);
    expect(clips.map((clip) => clip.text).join(' ')).toBe(content);
    expect(clips.every((clip) => clip.wordCount >= 8 && clip.wordCount <= 24)).toBe(true);
    expect(new Set(clips.map((clip) => clip.key)).size).toBe(clips.length);
  });

  it('usa la duración del subtítulo, no la del párrafo completo', () => {
    const clips = buildClips([
      {
        index: 0,
        title: 'Largo',
        blocks: [{ id: 'block-50', type: 'text', content: words(50), wordCount: 50 }],
      },
    ]);
    const state = playerReducer(createInitialState(), {
      type: 'load',
      clips,
      wpm: 240,
      speed: 1,
      imageDurationMs: 6000,
    });

    expect(getClipDuration(state)).toBe(4000);
  });

  it('convierte cada imagen en un clip sin palabras', () => {
    const clips = buildClips([
      {
        index: 0,
        title: 'Con imagen',
        blocks: [{ id: 'image', type: 'image', assetId: 'asset' }],
      },
    ]);

    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({ text: '', wordCount: 0, segmentIndex: 0, segmentCount: 1 });
  });
});

describe('duración del reproductor', () => {
  it('calcula duración de texto desde palabras, PPM y velocidad', () => {
    expect(getBlockDuration(20, 240, 1)).toBe(5000);
    expect(getBlockDuration(20, 240, 2)).toBe(2500);
    expect(getBlockDuration(20, 0, 1)).toBe(1_200_000);
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
    expect(getClipDuration(initial)).toBe(5000);

    const playing = playerReducer(initial, { type: 'play' });
    expect(playing.status).toBe('playing');
    const ticked = playerReducer(playing, { type: 'tick', deltaMs: 4000 });
    expect(ticked.elapsedMs).toBe(4000);
    expect(getActiveWordIndex(ticked)).toBe(16);

    const paused = playerReducer(ticked, { type: 'pause' });
    expect(playerReducer(paused, { type: 'tick', deltaMs: 4000 }).elapsedMs).toBe(4000);
  });

  it('avanza de clip acumulando el excedente del tick', () => {
    const playing = playerReducer(loaded(), { type: 'play' });
    const ticked = playerReducer(playing, { type: 'tick', deltaMs: 6000 });
    expect(ticked.clipIndex).toBe(1);
    expect(ticked.elapsedMs).toBe(1000);
    expect(getClipDuration(ticked)).toBe(6000);
  });

  it('termina al agotar el último clip', () => {
    const state: PlayerState = { ...loaded(), clipIndex: 2, status: 'playing', elapsedMs: 4500 };
    const ended = playerReducer(state, { type: 'tick', deltaMs: 1000 });
    expect(ended.status).toBe('ended');
    expect(ended.clipIndex).toBe(2);
    expect(ended.elapsedMs).toBe(5000);
  });

  it('recalcula la duración al cambiar velocidad sin perder la posición relativa', () => {
    const state: PlayerState = { ...loaded(), status: 'playing', elapsedMs: 2500 };
    const faster = playerReducer(state, { type: 'setSpeed', speed: 2 });
    expect(faster.status).toBe('playing');
    expect(getClipDuration(faster)).toBe(2500);
    expect(faster.elapsedMs).toBe(1250);
    expect(getClipDuration(faster) - faster.elapsedMs).toBe(1250);

    const slowerWpm = playerReducer(faster, { type: 'setWpm', wpm: 120 });
    expect(slowerWpm.elapsedMs).toBe(2500);
    expect(getClipDuration(slowerWpm)).toBe(5000);
  });

  it('seek y navegación manual sitúan el playhead sin detener la reproducción', () => {
    const state = playerReducer(loaded(), { type: 'play' });
    const seeked = playerReducer(state, { type: 'seek', clipIndex: 2, elapsedMs: 2000 });
    expect(seeked).toMatchObject({ status: 'playing', clipIndex: 2, elapsedMs: 2000 });

    const next = playerReducer(seeked, { type: 'next' });
    expect(next).toMatchObject({ status: 'playing', clipIndex: 2, elapsedMs: 0 });
    const previous = playerReducer(next, { type: 'previous' });
    expect(previous).toMatchObject({ status: 'playing', clipIndex: 1, elapsedMs: 0 });
  });

  it('align conserva el estado y calcula el porcentaje global', () => {
    const playing = playerReducer(loaded(), { type: 'play' });
    const aligned = playerReducer(playing, { type: 'align', elapsedMs: 2500 });
    expect(aligned.status).toBe('playing');
    expect(getActiveWordIndex(aligned)).toBe(10);
    expect(getProgressPercentage(aligned, 40)).toBe(25);
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
