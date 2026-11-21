import Dexie, { type EntityTable } from 'dexie';
import type { AppSettings, LeetoBook, ReadingProgress, SavedQuote, StoredAsset } from '@/types';

export class LeetoDatabase extends Dexie {
  books!: EntityTable<LeetoBook, 'id'>;
  assets!: EntityTable<StoredAsset, 'id'>;
  progress!: EntityTable<ReadingProgress, 'bookId'>;
  quotes!: EntityTable<SavedQuote, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('leeto');
    this.version(1).stores({
      books: 'id, title, author, saga, importedAt, updatedAt',
      assets: 'id, bookId, kind',
      progress: 'bookId, updatedAt',
      quotes: 'id, bookId, updatedAt, deletedAt',
      settings: 'id',
    });
  }
}

export const db = new LeetoDatabase();
