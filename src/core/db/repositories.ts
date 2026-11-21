import type { LeetoBook, ReadingProgress, SavedQuote, StoredAsset } from '@/types';
import { db } from './db';

export const booksRepo = {
  all: () => db.books.toArray(),
  get: (id: string) => db.books.get(id),
  put: (book: LeetoBook) => db.books.put(book),
  bulkPut: (books: LeetoBook[]) => db.books.bulkPut(books),
  delete: (id: string) => db.books.delete(id),
};

export const assetsRepo = {
  all: () => db.assets.toArray(),
  byBook: (bookId: string) => db.assets.where('bookId').equals(bookId).toArray(),
  get: (id: string) => db.assets.get(id),
  put: (asset: StoredAsset) => db.assets.put(asset),
  bulkPut: (assets: StoredAsset[]) => db.assets.bulkPut(assets),
  delete: (id: string) => db.assets.delete(id),
};

export const progressRepo = {
  get: (bookId: string) => db.progress.get(bookId),
  put: (progress: ReadingProgress) => db.progress.put(progress),
  delete: (bookId: string) => db.progress.delete(bookId),
};

export const quotesRepo = {
  all: () => db.quotes.toArray(),
  byBook: (bookId: string) => db.quotes.where('bookId').equals(bookId).toArray(),
  get: (id: string) => db.quotes.get(id),
  put: (quote: SavedQuote) => db.quotes.put(quote),
  delete: (id: string) => db.quotes.delete(id),
};
