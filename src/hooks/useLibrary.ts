import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db/db';
import type { LeetoBook, ReadingProgress, SavedQuote } from '@/types';

export function useBooks(): LeetoBook[] {
  return useLiveQuery(() => db.books.orderBy('importedAt').reverse().toArray(), [], []);
}

/** `true` mientras IndexedDB todavía no ha devuelto el listado. */
export function useBooksLoading(): boolean {
  return useLiveQuery(() => db.books.count(), [], undefined) === undefined;
}

export function useBookProgress(bookId?: string): ReadingProgress | undefined {
  return useLiveQuery(() => (bookId ? db.progress.get(bookId) : undefined), [bookId]);
}

/** Citas vigentes (excluye tombstones), más recientes primero. */
export function useQuotes(): SavedQuote[] {
  return useLiveQuery(
    () => db.quotes.filter((quote) => !quote.deletedAt).reverse().sortBy('updatedAt'),
    [],
    [],
  );
}
