import { BookOpen, Quote, Share2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { quoteChapterTitle } from '@/core/library/views';
import { formatQuoteShareText, softDeleteQuote } from '@/core/player/quotes';
import { notifyLocalSyncChange } from '@/core/sync/scheduler';
import { shareText } from '@/lib/share';
import type { LeetoBook, SavedQuote } from '@/types';

interface QuoteListProps {
  quotes: SavedQuote[];
  books: LeetoBook[];
  query: string;
}

const ICON_BUTTON_CLASS =
  'text-muted-foreground shrink-0 rounded-md p-1 transition-colors hover:text-primary disabled:opacity-50';

export default function QuoteList({ quotes, books, query }: QuoteListProps) {
  const [removing, setRemoving] = useState<string>();
  const [sharing, setSharing] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (quotes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
        <Quote className="text-muted-foreground mx-auto size-6" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">
          {query ? 'No hay citas que coincidan con la búsqueda' : 'No hay citas guardadas'}
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

  const handleShare = async (quote: SavedQuote, book: LeetoBook | undefined) => {
    setSharing(quote.id);
    try {
      const text = formatQuoteShareText(book, quote, quoteChapterTitle(book, quote.chapterIndex));
      const result = await shareText(text, book?.title ?? 'Cita de Leeto');
      if (result === 'cancelled') return;
      setNotice(
        result === 'copied'
          ? 'Cita copiada al portapapeles'
          : result === 'shared'
            ? 'Cita compartida'
            : 'No se pudo compartir',
      );
    } finally {
      setSharing(undefined);
    }
  };

  return (
    <div className="space-y-3">
      {notice && (
        <p
          role="status"
          className="bg-primary/10 text-primary rounded-lg px-3 py-2 text-xs font-medium"
        >
          {notice}
        </p>
      )}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {quotes.map((quote) => {
          const book = bookById.get(quote.bookId);
          const chapter = quoteChapterTitle(book, quote.chapterIndex);
          return (
            <li key={quote.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <BookOpen className="text-primary size-3.5 shrink-0" aria-hidden="true" />
                  <Link
                    to={`/read/${quote.bookId}`}
                    title={`Abrir fragmento en ${book?.title ?? 'el libro'}`}
                    className="text-primary min-w-0 truncate text-xs font-medium hover:underline"
                  >
                    {book?.title ?? 'Libro eliminado'}
                  </Link>
                  <span className="text-muted-foreground min-w-0 truncate text-[11px]">
                    · {chapter}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleShare(quote, book)}
                    disabled={sharing === quote.id}
                    aria-label="Compartir cita"
                    title="Compartir cita"
                    className={ICON_BUTTON_CLASS}
                  >
                    <Share2 className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(quote.id)}
                    disabled={removing === quote.id}
                    aria-label="Eliminar cita"
                    title="Eliminar cita"
                    className={`${ICON_BUTTON_CLASS} hover:text-destructive`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <blockquote className="font-reading mt-3 break-words whitespace-normal text-sm italic">
                “{quote.excerpt}”
              </blockquote>
              {quote.note && (
                <p className="text-muted-foreground mt-2 text-xs">Nota: {quote.note}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
