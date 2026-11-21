export interface PlayerClock {
  start(): void;
  stop(): void;
}

/**
 * Reloj único basado en rAF con acumulador. Limitamos la frecuencia de dispatch
 * para no re-renderizar a 60 fps y recortamos saltos largos (pestaña oculta).
 */
export function createPlayerClock(
  onTick: (deltaMs: number) => void,
  dispatchIntervalMs = 50,
): PlayerClock {
  let frame = 0;
  let lastTimestamp = 0;
  let accumulated = 0;
  let running = false;

  const loop = (timestamp: number) => {
    if (!running) return;
    if (lastTimestamp === 0) lastTimestamp = timestamp;
    accumulated += Math.min(100, Math.max(0, timestamp - lastTimestamp));
    lastTimestamp = timestamp;

    if (accumulated >= dispatchIntervalMs) {
      onTick(accumulated);
      accumulated = 0;
    }
    frame = requestAnimationFrame(loop);
  };

  return {
    start() {
      if (running) return;
      running = true;
      lastTimestamp = 0;
      accumulated = 0;
      frame = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
    },
  };
}
