import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db/db';
import type { LeetoBook, ReadingProgress } from '@/types';

export function useBooks(): LeetoBook[] {
  return useLiveQuery(() => db.books.orderBy('importedAt').reverse().toArray(), [], []);
}

export function useBookProgress(bookId?: string): ReadingProgress | undefined {
  return useLiveQuery(() => (bookId ? db.progress.get(bookId) : undefined), [bookId]);
}
