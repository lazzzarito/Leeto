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
  return useLiveQuery(() => (bookId ? db.progress.get(bookId) : undefined), [bookId]);
}

/** Progreso de toda la biblioteca, para las vistas Leyendo y Leídos. */
export function useProgressByBook(): Map<string, ReadingProgress> {
  const items = useLiveQuery(() => db.progress.toArray(), [], []);
  return useMemo(() => new Map(items.map((item) => [item.bookId, item])), [items]);
}

/** Citas vigentes (excluye tombstones), más recientes primero. */
export function useQuotes(): SavedQuote[] {
  return useLiveQuery(
    () => db.quotes.filter((quote) => !quote.deletedAt).reverse().sortBy('updatedAt'),
    [],
    [],
  );
}
