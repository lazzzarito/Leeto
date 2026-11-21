/** Formatea milisegundos como `1 h 23 min` / `4 min 12 s` / `38 s`. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
}

/** Milisegundos restantes estimados a partir de palabras pendientes, PPM y velocidad. */
export function estimateRemainingTime(
  totalWordCount: number,
  consumedWordCount: number,
  wpm: number,
  speed = 1,
): number {
  const remainingWords = Math.max(0, totalWordCount - consumedWordCount);
  const effectiveWpm = Math.max(1, wpm) * Math.max(0.1, speed);
  return (remainingWords / effectiveWpm) * 60_000;
}

/** Porcentaje 0..100 con un decimal, derivado de palabras consumidas. */
export function estimatePercentage(totalWordCount: number, consumedWordCount: number): number {
  if (totalWordCount <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, consumedWordCount / totalWordCount));
  return Math.round(ratio * 1000) / 10;
}
