import type { SyncEnvelope } from '@/types';
import { recordsFingerprint } from './merge';

const localChangeListeners = new Set<() => void>();

/** Avisa de un cambio del usuario (progreso/cita) para disparar sync con debounce. */
export function notifyLocalSyncChange(): void {
  localChangeListeners.forEach((listener) => listener());
}

export function subscribeLocalSyncChange(listener: () => void): () => void {
  localChangeListeners.add(listener);
  return () => localChangeListeners.delete(listener);
}

export interface SchedulerState {
  running: boolean;
  lastRunAt?: number;
  lastError?: string;
  nextRetryAt?: number;
}

/** Evita bucles: ignora sobrees propias ya escritas en este dispositivo. */
export interface LoopGuard {
  shouldSkip(envelope: SyncEnvelope): boolean;
  markWritten(envelope: SyncEnvelope): void;
}

export function createLoopGuard(deviceId: string): LoopGuard {
  let lastWritten: SyncEnvelope | undefined;
  return {
    shouldSkip(envelope) {
      if (envelope.originDeviceId !== deviceId || !lastWritten) return false;
      return recordsFingerprint(envelope) === recordsFingerprint(lastWritten);
    },
    markWritten(envelope) {
      lastWritten = envelope;
    },
  };
}

export interface SyncSchedulerOptions {
  run: () => Promise<void>;
  debounceMs?: number;
  minIntervalMs?: number;
  backoff?: { initialMs: number; maxMs: number; factor: number };
  onError?: (error: unknown) => void;
  now?: () => number;
}

export interface SyncScheduler {
  /** Solicita una ejecución agrupando disparos cercanos. */
  trigger(): void;
  /** Ejecuta ahora (puede ser cancelada por una ejecución en curso). */
  runNow(): Promise<void>;
  start(): void;
  stop(): void;
  readonly state: SchedulerState;
}

/** Serializa ejecuciones, agrupa disparos y aplica backoff ante fallos. */
export function createSyncScheduler({
  run,
  debounceMs = 800,
  minIntervalMs = 5000,
  backoff = { initialMs: 10_000, maxMs: 5 * 60_000, factor: 2 },
  onError,
  now = Date.now,
}: SyncSchedulerOptions): SyncScheduler {
  const state: SchedulerState = { running: false };
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let pendingAfterRun = false;
  let failureCount = 0;

  function scheduleTrigger(): void {
    if (state.nextRetryAt && now() < state.nextRetryAt) return;
    if (inFlight) {
      pendingAfterRun = true;
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    const elapsed = state.lastRunAt === undefined ? Infinity : now() - state.lastRunAt;
    const delay = Math.max(debounceMs, minIntervalMs - elapsed);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void execute();
    }, delay);
  }

  async function execute(): Promise<void> {
    if (inFlight) return inFlight;
    state.running = true;
    inFlight = (async () => {
      try {
        await run();
        failureCount = 0;
        state.lastError = undefined;
        state.nextRetryAt = undefined;
        state.lastRunAt = now();
      } catch (error) {
        failureCount += 1;
        state.lastError = error instanceof Error ? error.message : String(error);
        const delay = Math.min(
          backoff.maxMs,
          backoff.initialMs * backoff.factor ** (failureCount - 1),
        );
        state.nextRetryAt = now() + delay;
        onError?.(error);
      } finally {
        state.running = false;
        inFlight = undefined;
        if (pendingAfterRun) {
          pendingAfterRun = false;
          // Un cambio local llegó mientras se leía el remoto: publicarlo, pero
          // respetando el backoff si la sincronización acaba de fallar.
          scheduleTrigger();
        }
      }
    })();
    return inFlight;
  }

  return {
    state,
    trigger() {
      scheduleTrigger();
    },
    runNow() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      return execute();
    },
    start() {
      if (retryTimer) return;
      retryTimer = setInterval(() => {
        if (state.nextRetryAt && now() >= state.nextRetryAt) {
          state.nextRetryAt = undefined;
          void execute();
        }
      }, 1000);
    },
    stop() {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (retryTimer) clearInterval(retryTimer);
      debounceTimer = undefined;
      retryTimer = undefined;
      pendingAfterRun = false;
    },
  };
}
