/** Duración de un bloque de texto a partir de palabras, PPM y velocidad. */
export function getBlockDuration(wordCount: number, wpm: number, speed: number): number {
  const effectiveWpm = Math.max(1, wpm) * Math.max(0.1, speed);
  return (Math.max(0, wordCount) / effectiveWpm) * 60_000;
}

/** Duración de una imagen (clip) ajustada por velocidad. */
export function getImageDuration(baseMs: number, speed: number): number {
  return Math.max(500, baseMs / Math.max(0.1, speed));
}

/** Milisegundos por palabra; útil para situar el playhead dentro del bloque. */
export function getWordDuration(wordCount: number, wpm: number, speed: number): number {
  if (wordCount <= 0) return 0;
  return getBlockDuration(wordCount, wpm, speed) / wordCount;
}
