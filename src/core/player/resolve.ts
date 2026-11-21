import type { PlayerClip } from './state';

export interface ClipTarget {
  blockId: string;
  segmentIndex?: number;
}

/** Resuelve una referencia persistida a un clip, con degradación segura. */
export function findClipIndex(clips: PlayerClip[], target: ClipTarget): number {
  if (target.segmentIndex !== undefined) {
    const exact = clips.findIndex(
      (clip) => clip.block.id === target.blockId && clip.segmentIndex === target.segmentIndex,
    );
    if (exact >= 0) return exact;
  }

  const firstInBlock = clips.findIndex((clip) => clip.block.id === target.blockId);
  return Math.max(0, firstInBlock);
}
