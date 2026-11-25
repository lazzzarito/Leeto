import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/core/db/db';
import type { LeetoBook, ReadingProgress, SavedQuote } from '@/types';

export function useBooks(): LeetoBook[] {
  return useLiveQuery(() => db.books.orderBy('importedAt').reverse().toArray(), [], []);
}

/** `true` mientras IndexedDB todavía no ha devuelto el listado. */
export function useBooksLoading(): boolean {
  return useLiveQuery(() => db.books.count(), [], undefined) === undefined;
}

/** Número total de libros, para contadores de navegación. */
export function useBookCount(): number {
  return useLiveQuery(() => db.books.count(), [], 0);
}

/** Número de favoritos; solo se recalcula cuando cambia la biblioteca. */
export function useFavoriteCount(): number {
  return useLiveQuery(() => db.books.filter((book) => book.favorite === true).count(), [], 0);
}

export function useBookProgress(bookId?: string): ReadingProgress | undefined {
  const progress = useLiveQuery(() => (bookId ? db.progress.get(bookId) : undefined), [bookId]);
  return progress?.deletedAt ? undefined : progress;
}

/**
 * Progreso y estado de carga de una sola lectura de IndexedDB.
 * Dos live queries independientes podían devolver `loaded=true` antes que el
 * registro, y el lector interpretaba el libro como nuevo.
 */
export function useBookProgressState(
  bookId?: string,
): { progress?: ReadingProgress; loaded: boolean } {
  return useLiveQuery(
    async () => {
      if (!bookId) return { loaded: true };
      const record = await db.progress.get(bookId);
      return {
        progress: record?.deletedAt ? undefined : record,
        loaded: true,
      };
    },
    [bookId],
    { loaded: false },
  );
}

/** `false` mientras IndexedDB no ha respondido si existe progreso para el libro. */
export function useBookProgressLoaded(bookId?: string): boolean {
  return useBookProgressState(bookId).loaded;
}

/** Progreso de toda la biblioteca, para las vistas Leyendo y Leídos. */
export function useProgressByBook(): Map<string, ReadingProgress> {
  const items = useLiveQuery(() => db.progress.toArray(), [], []);
  return useMemo(
    () => new Map(items.filter((item) => !item.deletedAt).map((item) => [item.bookId, item])),
    [items],
  );
}

/** Citas vigentes (excluye tombstones), más recientes primero. */
export function useQuotes(): SavedQuote[] {
  return useLiveQuery(
    () => db.quotes.filter((quote) => !quote.deletedAt).reverse().sortBy('updatedAt'),
    [],
    [],
  );
}
