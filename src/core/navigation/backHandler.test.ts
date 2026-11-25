import { describe, expect, it, vi } from 'vitest';
import { handleAppBack, registerBackHandler } from './backHandler';

describe('back de la app', () => {
  it('ejecuta los handlers por prioridad y se detiene en el primero que responde', () => {
    const calls: string[] = [];
    const unregisterLow = registerBackHandler(() => {
      calls.push('low');
      return true;
    }, 0);
    const unregisterHigh = registerBackHandler(() => {
      calls.push('high');
      return false;
    }, 10);
    const unregisterHigh2 = registerBackHandler(() => {
      calls.push('high2');
      return true;
    }, 10);

    expect(handleAppBack()).toBe(true);
    // A igual prioridad se conserva el orden de registro; `high` declina y `high2` responde.
    expect(calls).toEqual(['high', 'high2']);

    unregisterHigh2();
    expect(handleAppBack()).toBe(true);
    expect(calls).toEqual(['high', 'high2', 'high', 'low']);

    unregisterLow();
    unregisterHigh();
  });

  it('un handler que lanza no bloquea a los demás', () => {
    const fallback = vi.fn(() => true);
    const unregisterBroken = registerBackHandler(() => {
      throw new Error('roto');
    }, 20);
    const unregisterFallback = registerBackHandler(fallback, 0);

    expect(handleAppBack()).toBe(true);
    expect(fallback).toHaveBeenCalledOnce();

    unregisterBroken();
    unregisterFallback();
  });

  it('devuelve false cuando nadie gestiona el back', () => {
    expect(handleAppBack()).toBe(false);
  });
});
