import { describe, expect, it } from 'vitest';
import type { LeetoBook, SavedQuote } from '@/types';
import {
  filterBooks,
  filterQuotes,
  groupByAuthor,
  groupBySaga,
  normalizeSearchText,
  quoteChapterTitle,
  sortByVolume,
} from './views';

function book(overrides: Partial<LeetoBook> & { title: string; id: string }): LeetoBook {
  return {
    contentHash: overrides.id,
    author: 'Autor',
    fileName: `${overrides.id}.epub`,
    fileSize: 100,
    mimeType: 'application/epub+zip',
    chapters: [],
    totalWordCount: 0,
    importedAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const books: LeetoBook[] = [
  book({ id: 'a', title: 'La ciudad de cristal', author: 'Ana Autora', saga: 'Crístal', volumeNumber: 2 }),
  book({ id: 'b', title: 'El bosque', author: 'Bruno', saga: 'Crístal', volumeNumber: 1 }),
  book({ id: 'c', title: 'Sin hogar', author: 'Ana Autora', saga: 'Crístal' }),
  book({ id: 'd', title: 'Crystal', author: 'Zoe', saga: 'Otra saga', volumeNumber: 3 }),
];

describe('vistas de biblioteca', () => {
  it('normaliza acentos y mayúsculas en la búsqueda', () => {
    expect(normalizeSearchText('Crístal')).toBe('cristal');
    expect(normalizeSearchText('ÁÉÍÓÚÑ')).toBe('aeioun');
  });

  it('filtra por título, autor y saga de forma tolerante', () => {
    expect(filterBooks(books, 'cristal').map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(filterBooks(books, 'ana').map((item) => item.id)).toEqual(['a', 'c']);
    expect(filterBooks(books, 'otra').map((item) => item.id)).toEqual(['d']);
    expect(filterBooks(books, '   ')).toHaveLength(4);
  });

  it('filtra citas por excerpt y nota', () => {
    const quotes: SavedQuote[] = [
      {
        id: 'q1',
        bookId: 'a',
        chapterIndex: 0,
        blockId: 'b1',
        excerpt: 'Era una mañana de niebla',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'q2',
        bookId: 'b',
        chapterIndex: 1,
        blockId: 'b2',
        excerpt: 'El sendero',
        note: 'Recordar la escena del bosque',
        createdAt: 0,
        updatedAt: 0,
      },
    ];
    expect(filterQuotes(quotes, 'niebla').map((quote) => quote.id)).toEqual(['q1']);
    expect(filterQuotes(quotes, 'BOSQUE').map((quote) => quote.id)).toEqual(['q2']);
    expect(filterQuotes(quotes, '')).toHaveLength(2);
  });

  it('ordena sagas por volumen, con los nulos al final', () => {
    expect(sortByVolume(books.slice(0, 3)).map((item) => item.id)).toEqual(['b', 'a', 'c']);
    const groups = groupBySaga(books);
    expect(groups.map((group) => group.label)).toEqual(['Crístal', 'Otra saga']);
    expect(groups[0]?.books.map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('agrupa por autor y coloca los libros sin saga al final', () => {
    const authors = groupByAuthor([...books, book({ id: 'e', title: 'Anónimo', author: '' })]);
    expect(authors[0]?.label).toBe('Ana Autora');
    expect(authors.at(-1)?.label).toBe('Autor desconocido');
    expect(groupBySaga([...books, book({ id: 'e', title: 'Anónimo' })])[2]?.label).toBe('Sin saga');
  });

  it('resuelve el capítulo de una cita', () => {
    const withChapters = book({
      id: 'a',
      title: 'Libro',
      chapters: [{ index: 0, title: 'El inicio', blocks: [] }],
    });
    expect(quoteChapterTitle(withChapters, 0)).toBe('El inicio');
    expect(quoteChapterTitle(withChapters, 4)).toBe('Capítulo 5');
  });
});
