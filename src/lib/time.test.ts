import { describe, expect, it } from 'vitest';
import { estimatePercentage, estimateRemainingTime, formatDuration } from './time';

describe('time utilities', () => {
  it('formatea duraciones según magnitud', () => {
    expect(formatDuration(38_000)).toBe('38 s');
    expect(formatDuration(252_000)).toBe('4 min 12 s');
    expect(formatDuration(5_400_000)).toBe('1 h 30 min');
  });

  it('estima el tiempo restante aplicando PPM y velocidad', () => {
    expect(estimateRemainingTime(240, 0, 240)).toBe(60_000);
    expect(estimateRemainingTime(240, 0, 240, 2)).toBe(30_000);
    expect(estimateRemainingTime(240, 240, 240)).toBe(0);
  });

  it('calcula porcentajes acotados entre 0 y 100', () => {
    expect(estimatePercentage(200, 50)).toBe(25);
    expect(estimatePercentage(200, 400)).toBe(100);
    expect(estimatePercentage(0, 10)).toBe(0);
  });
});
