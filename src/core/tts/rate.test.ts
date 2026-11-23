import { describe, expect, it } from 'vitest';
import { getSpeechRate } from './rate';

describe('getSpeechRate', () => {
  it('iguala la voz al ritmo visual de palabras por minuto', () => {
    expect(getSpeechRate(190, 1)).toBe(1);
    expect(getSpeechRate(240, 1)).toBeCloseTo(240 / 190, 3);
    expect(getSpeechRate(120, 1.5)).toBeCloseTo(180 / 190, 3);
  });

  it('limita la velocidad a un rango natural para la voz', () => {
    expect(getSpeechRate(240, 4)).toBe(2);
    expect(getSpeechRate(60, 1)).toBe(0.5);
  });
});
