import type { LeetoBook, ReadingProgress, SavedQuote } from '@/types';

export interface BookGroup {
  key: string;
  label: string;
  books: LeetoBook[];
}

export type ReadingStatus = 'reading' | 'finished';

/** El progreso se guarda redondeado a un decimal; 100 % marca el final. */
const FINISHED_PERCENTAGE = 99.5;

export function getReadingStatus(progress?: ReadingProgress): ReadingStatus | undefined {
  const percentage = progress?.percentage ?? 0;
  if (percentage >= FINISHED_PERCENTAGE) return 'finished';
  if (percentage > 0) return 'reading';
  return undefined;
}

export function filterBooksByStatus(
  books: LeetoBook[],
  progressByBook: Map<string, ReadingProgress>,
  status: ReadingStatus,
): LeetoBook[] {
  return books.filter((book) => getReadingStatus(progressByBook.get(book.id)) === status);
}

export function countBooksByStatus(
  books: LeetoBook[],
  progressByBook: Map<string, ReadingProgress>,
): Record<ReadingStatus, number> {
  const counts: Record<ReadingStatus, number> = { reading: 0, finished: 0 };
  const ids = new Set(books.map((book) => book.id));
  for (const [bookId, progress] of progressByBook) {
    if (!ids.has(bookId)) continue;
    const status = getReadingStatus(progress);
    if (status) counts[status] += 1;
  }
  return counts;
}

export function filterBooksByFavorite(books: LeetoBook[]): LeetoBook[] {
  return books.filter((book) => book.favorite === true);
}

/** Normaliza acentos y mayúsculas para búsquedas tolerantes. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

function matches(query: string, ...values: Array<string | undefined>): boolean {
  if (!query) return true;
  return values.some((value) => value && normalizeSearchText(value).includes(query));
}

export function filterBooks(books: LeetoBook[], query: string): LeetoBook[] {
  const normalized = normalizeSearchText(query.trim());
  if (!normalized) return books;
  return books.filter((book) => matches(normalized, book.title, book.author, book.saga));
}

export function filterQuotes(quotes: SavedQuote[], query: string): SavedQuote[] {
  const normalized = normalizeSearchText(query.trim());
  if (!normalized) return quotes;
  return quotes.filter((quote) => matches(normalized, quote.excerpt, quote.note));
}

/** Ordena por volumen ascendente; los libros sin volumen van al final. */
export function sortByVolume(books: LeetoBook[]): LeetoBook[] {
  return [...books].sort((a, b) => {
    const volumeA = a.volumeNumber;
    const volumeB = b.volumeNumber;
    if (volumeA !== undefined && volumeB !== undefined && volumeA !== volumeB) {
      return volumeA - volumeB;
    }
    if ((volumeA === undefined) !== (volumeB === undefined)) {
      return volumeA === undefined ? 1 : -1;
    }
    return a.title.localeCompare(b.title, 'es');
  });
}

const UNKNOWN_AUTHOR = 'Autor desconocido';
const NO_SAGA = 'Sin saga';

function groupBooks(
  books: LeetoBook[],
  keyOf: (book: LeetoBook) => string,
  labelOf: (book: LeetoBook) => string,
  sortBooks: (books: LeetoBook[]) => LeetoBook[] = (items) => items,
): BookGroup[] {
  const groups = new Map<string, BookGroup>();
  for (const book of books) {
    const key = keyOf(book);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: labelOf(book), books: [] };
      groups.set(key, group);
    }
    group.books.push(book);
  }

  return [...groups.values()]
    .map((group) => ({ ...group, books: sortBooks(group.books) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
}

export function groupByAuthor(books: LeetoBook[]): BookGroup[] {
  const groups = groupBooks(
    books,
    (book) => normalizeSearchText(book.author ?? '') || UNKNOWN_AUTHOR,
    (book) => book.author || UNKNOWN_AUTHOR,
  );
  return groups.sort((a, b) => {
    if (a.label === UNKNOWN_AUTHOR) return 1;
    if (b.label === UNKNOWN_AUTHOR) return -1;
    return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
  });
}

export function groupBySaga(books: LeetoBook[]): BookGroup[] {
  const groups = groupBooks(
    books,
    (book) => normalizeSearchText(book.saga ?? '') || NO_SAGA,
    (book) => book.saga || NO_SAGA,
    sortByVolume,
  );
  // Los libros sueltos no son una saga: al final.
  return groups.sort((a, b) => {
    if (a.label === NO_SAGA) return 1;
    if (b.label === NO_SAGA) return -1;
    return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
  });
}

/** Contexto legible de una cita para mostrar book/capítulo en la lista. */
export function quoteChapterTitle(book: LeetoBook | undefined, chapterIndex: number): string {
  return book?.chapters[chapterIndex]?.title ?? `Capítulo ${chapterIndex + 1}`;
}
