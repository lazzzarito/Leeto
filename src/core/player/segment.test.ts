import { describe, expect, it } from 'vitest';
import { splitIntoSegments } from './segment';

const words = (count: number, prefix = 'palabra') =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(' ');

const counts = (segments: string[]) => segments.map((segment) => segment.split(/\s+/).length);

describe('splitIntoSegments', () => {
  it('divide un párrafo largo en segmentos acotados y conserva el orden', () => {
    const original = words(50);

    const segments = splitIntoSegments(original);

    expect(segments.length).toBeGreaterThan(2);
    expect(counts(segments).every((count) => count >= 8 && count <= 24)).toBe(true);
    expect(segments.join(' ')).toBe(original);
  });

  it('prefiere terminar en signos de puntuación', () => {
    const segments = splitIntoSegments(`${words(10, 'uno')}. ${words(10, 'dos')}.`);

    expect(segments).toHaveLength(2);
    expect(segments[0]?.endsWith('.')).toBe(true);
    expect(segments[1]?.endsWith('.')).toBe(true);
  });

  it('une oraciones demasiado cortas en un solo segmento legible', () => {
    const segments = splitIntoSegments('Vino. Vio. Ganó.');

    expect(segments).toEqual(['Vino. Vio. Ganó.']);
  });

  it('parte por comas sin perder la puntuación cuando la oración es larga', () => {
    const text = `${words(12, 'uno')}, ${words(12, 'dos')}, ${words(12, 'tres')}.`;

    const segments = splitIntoSegments(text);

    expect(segments).toHaveLength(3);
    expect(segments[0]?.endsWith(',')).toBe(true);
    expect(segments[2]?.endsWith('.')).toBe(true);
    expect(segments.join(' ')).toBe(text);
  });

  it('agrupa en frases cortas un texto continuo sin puntuación', () => {
    const segments = splitIntoSegments(words(60, 'flujo'));

    expect(segments.length).toBeGreaterThan(2);
    expect(Math.max(...counts(segments))).toBeLessThanOrEqual(24);
    expect(Math.min(...counts(segments))).toBeGreaterThanOrEqual(8);
    expect(segments.join(' ')).toBe(words(60, 'flujo'));
  });

  it('devuelve vacío para texto sin contenido', () => {
    expect(splitIntoSegments('   \n  ')).toEqual([]);
  });

  it('es determinista para el mismo texto', () => {
    const text = `${words(9, 'a')}. ${words(18, 'b')}, ${words(7, 'c')}.`;

    expect(splitIntoSegments(text)).toEqual(splitIntoSegments(text));
  });
});
