import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyEnvelope } from './envelope';
import { createLoopGuard, createSyncScheduler } from './scheduler';

afterEach(() => {
  vi.useRealTimers();
});

describe('planificador de sincronización', () => {
  it('agrupa disparos cercanos en una sola ejecución', async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValue(undefined);
    const scheduler = createSyncScheduler({ run, debounceMs: 100, minIntervalMs: 1000 });

    scheduler.trigger();
    scheduler.trigger();
    await vi.advanceTimersByTimeAsync(100);

    expect(run).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('no solapa ejecuciones', async () => {
    let resolveRun: () => void = () => undefined;
    let calls = 0;
    const run = vi.fn(() => {
      calls += 1;
      if (calls > 1) return Promise.resolve();
      return new Promise<void>((resolve) => {
        resolveRun = resolve;
      });
    });
    const scheduler = createSyncScheduler({ run });

    const first = scheduler.runNow();
    const second = scheduler.runNow();
    expect(run).toHaveBeenCalledTimes(1);
    resolveRun();
    await Promise.all([first, second]);

    await scheduler.runNow();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('aplica backoff y limpia el error al recuperarse', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('red caída'))
      .mockResolvedValue(undefined);
    const onError = vi.fn();
    const scheduler = createSyncScheduler({
      run,
      backoff: { initialMs: 10_000, maxMs: 60_000, factor: 2 },
      onError,
    });

    await scheduler.runNow();
    expect(scheduler.state.lastError).toBe('red caída');
    expect(scheduler.state.nextRetryAt).toBe(Date.now() + 10_000);
    expect(onError).toHaveBeenCalledOnce();

    scheduler.trigger();
    await vi.advanceTimersByTimeAsync(900);
    expect(run).toHaveBeenCalledTimes(1);

    await scheduler.runNow();
    expect(scheduler.state.lastError).toBeUndefined();
    expect(scheduler.state.nextRetryAt).toBeUndefined();
    expect(scheduler.state.lastRunAt).toBe(Date.now());
  });
});

describe('protección contra bucles', () => {
  it('ignora solo el sobre propio ya escrito', () => {
    const guard = createLoopGuard('dev_A');
    const written = createEmptyEnvelope('dev_A', 100);

    expect(guard.shouldSkip(written)).toBe(false);
    guard.markWritten(written);
    expect(guard.shouldSkip(written)).toBe(true);
    // El sello de escritura (devices/updatedAt) no cuenta como cambio de contenido.
    expect(guard.shouldSkip({ ...written, updatedAt: 101 })).toBe(true);
    expect(
      guard.shouldSkip({
        ...written,
        progress: {
          book_1: {
            bookId: 'book_1',
            chapterIndex: 0,
            blockId: 'b_001',
            percentage: 99,
            updatedAt: 101,
            deviceId: 'dev_A',
          },
        },
      }),
    ).toBe(false);
    expect(guard.shouldSkip({ ...written, originDeviceId: 'dev_B' })).toBe(false);
  });
});
