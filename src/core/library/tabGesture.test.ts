import { describe, expect, it } from 'vitest';
import { adjacentLibraryTab } from './tabGesture';

describe('adjacentLibraryTab', () => {
  it('avanza con swipe horizontal a la izquierda y retrocede a la derecha', () => {
    expect(adjacentLibraryTab('favorites', -60, 0)).toBe('all');
    expect(adjacentLibraryTab('favorites', 60, 0)).toBe('finished');
  });

  it('avanza con swipe vertical hacia arriba y retrocede hacia abajo', () => {
    expect(adjacentLibraryTab('favorites', 0, -60)).toBe('all');
    expect(adjacentLibraryTab('favorites', 0, 60)).toBe('finished');
  });

  it('ignora gestos cortos, diagonales y pestañas desconocidas', () => {
    expect(adjacentLibraryTab('favorites', 0, 40)).toBeUndefined();
    expect(adjacentLibraryTab('favorites', 50, 60)).toBeUndefined();
    expect(adjacentLibraryTab('unknown', -80, 0)).toBeUndefined();
  });

  it('respeta los límites de la lista', () => {
    expect(adjacentLibraryTab('reading', 80, 0)).toBeUndefined();
    expect(adjacentLibraryTab('quotes', -80, 0)).toBeUndefined();
  });
});
