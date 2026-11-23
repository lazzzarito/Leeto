/** Ritmo aproximado de una voz del sistema a `rate = 1` (palabras por minuto). */
export const TTS_BASE_WPM = 190;

/**
 * La voz debe durar lo mismo que el resaltado visual: el reproductor usa
 * `wpm * speed`, mientras la voz usa `rate` sobre su ritmo por defecto.
 */
export function getSpeechRate(wpm: number, speed: number): number {
  const effectiveWpm = Math.max(1, wpm) * Math.max(0.1, speed);
  return Math.min(2, Math.max(0.5, effectiveWpm / TTS_BASE_WPM));
}
