import { Quote, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { softDeleteQuote } from '@/core/player/quotes';
import { notifyLocalSyncChange } from '@/core/sync/scheduler';
import { quoteChapterTitle } from '@/core/library/views';
import type { LeetoBook, SavedQuote } from '@/types';

interface QuoteListProps {
  quotes: SavedQuote[];
  books: LeetoBook[];
  query: string;
}

export default function QuoteList({ quotes, books, query }: QuoteListProps) {
  const [removing, setRemoving] = useState<string>();

  if (quotes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
        <Quote className="text-muted-foreground mx-auto size-6" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">
          {query ? 'No hay citas que coincidan con la búsqueda' : 'Todavía no hay citas guardadas'}
        </p>
        {!query && (
          <p className="text-muted-foreground mt-1 text-xs">
            Guarda fragmentos mientras lees para encontrarlos aquí.
          </p>
        )}
      </div>
    );
  }

  const bookById = new Map(books.map((book) => [book.id, book]));

  const handleDelete = async (id: string) => {
    setRemoving(id);
    try {
      await softDeleteQuote(id);
      notifyLocalSyncChange();
    } finally {
      setRemoving(undefined);
    }
  };

  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {quotes.map((quote) => {
        const book = bookById.get(quote.bookId);
        return (
          <li key={quote.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <blockquote className="font-reading text-sm italic">“{quote.excerpt}”</blockquote>
              <button
                type="button"
                onClick={() => void handleDelete(quote.id)}
                disabled={removing === quote.id}
                aria-label="Eliminar cita"
                title="Eliminar cita"
                className="text-muted-foreground hover:text-destructive shrink-0 rounded-md p-1 disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
            {quote.note && (
              <p className="text-muted-foreground mt-2 text-xs">Nota: {quote.note}</p>
            )}
            <Link
              to={`/read/${quote.bookId}`}
              className="text-primary mt-3 block truncate text-xs hover:underline"
            >
              {book?.title ?? 'Libro eliminado'} ·{' '}
              {quoteChapterTitle(book, quote.chapterIndex)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
