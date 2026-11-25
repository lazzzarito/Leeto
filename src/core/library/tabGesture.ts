/** Gestos para cambiar de pestaña en la biblioteca (horizontal o vertical). */

export const LIBRARY_TABS = [
  'reading',
  'finished',
  'favorites',
  'all',
  'authors',
  'sagas',
  'quotes',
] as const;

export type LibraryTab = (typeof LIBRARY_TABS)[number];

export const TAB_SWIPE_THRESHOLD = 48;

/**
 * Devuelve la pestaña vecina según el gesto dominante.
 * Deslizar a la izquierda o hacia arriba avanza; a la derecha o abajo retrocede.
 */
export function adjacentLibraryTab(
  current: string,
  dx: number,
  dy: number,
): LibraryTab | undefined {
  const index = LIBRARY_TABS.indexOf(current as LibraryTab);
  if (index < 0) return undefined;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const horizontal = absX >= absY;
  const delta = horizontal ? dx : dy;
  const other = horizontal ? absY : absX;
  if (Math.abs(delta) < TAB_SWIPE_THRESHOLD || Math.abs(delta) < other * 1.3) {
    return undefined;
  }

  return LIBRARY_TABS[index + (delta < 0 ? 1 : -1)];
}
