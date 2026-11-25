import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useRef, type CSSProperties } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  countBooksByStatus,
  filterBooks,
  filterBooksByFavorite,
  filterBooksByStatus,
  filterQuotes,
  groupByAuthor,
  groupBySaga,
} from '@/core/library/views';
import { adjacentLibraryTab } from '@/core/library/tabGesture';

import type { LeetoBook, ReadingProgress, SavedQuote } from '@/types';
import BookCard from './BookCard';
import QuoteList from './QuoteList';

interface LibraryTabsProps {
  books: LeetoBook[];
  quotes: SavedQuote[];
  progressByBook: Map<string, ReadingProgress>;
  query: string;
  value: string;
  onValueChange: (value: string) => void;
  onEdit: (book: LeetoBook) => void;
  onDelete: (book: LeetoBook) => void;
}

const TRIGGER_CLASS =
  'bg-muted/60 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex h-9 shrink-0 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors sm:text-sm';

const GRID_CLASS = 'grid auto-rows-[8px] grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

function NoResults({ message = 'No hay resultados para esta búsqueda.' }: { message?: string }) {
  return (
    <p className="text-muted-foreground rounded-xl border border-border bg-card px-6 py-10 text-center text-sm">
      {message}
    </p>
  );
}

function BookGrid({
  books,
  onEdit,
  onDelete,
}: Pick<LibraryTabsProps, 'books' | 'onEdit' | 'onDelete'>) {
  return (
    <ul className={GRID_CLASS}>
      {books.map((book) => (
        <BookCard key={book.id} book={book} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </ul>
  );
}

export default function LibraryTabs({
  books,
  quotes,
  progressByBook,
  query,
  value,
  onValueChange,
  onEdit,
  onDelete,
}: LibraryTabsProps) {
  const statusCounts = countBooksByStatus(books, progressByBook);
  const visibleBooks = filterBooks(books, query);
  const visibleReading = filterBooksByStatus(visibleBooks, progressByBook, 'reading');
  const visibleFinished = filterBooksByStatus(visibleBooks, progressByBook, 'finished');
  const visibleFavorites = filterBooksByFavorite(visibleBooks);
  const visibleQuotes = filterQuotes(quotes, query);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { chromeHidden } = useOutletContext<{ chromeHidden: boolean }>() ?? { chromeHidden: false };
  const tabsListRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const suppressClickRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  useEffect(() => {
    if (isDesktop) return;
    const active = tabsListRef.current?.querySelector<HTMLElement>('[data-state="active"]');
    if (!active) return;
    programmaticScrollRef.current = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    active.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: reduced ? 'auto' : 'smooth',
    });
    const timer = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 350);
    return () => window.clearTimeout(timer);
  }, [value, isDesktop]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isDesktop) return;
    const target = event.target as HTMLElement;
    if (target.closest('input,select,textarea,[role="dialog"]')) {
      touchStartRef.current = undefined;
      return;
    }
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (isDesktop) return;
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = undefined;
    if (!start || !touch) return;
    const target = event.target as HTMLElement;
    if (target.closest('input,select,textarea,[role="dialog"]')) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const next = adjacentLibraryTab(value, dx, dy);
    if (!next) return;

    // Un swipe vertical desde el inicio de la lista cambia de pestaña; si la
    // lista está desplazada, el gesto pertenece al scroll.
    if (Math.abs(dy) > Math.abs(dx) && Math.max(0, document.scrollingElement?.scrollTop ?? window.scrollY ?? 0) > 2) {
      return;
    }

    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 350);
    onValueChange(next);
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  return (
    <Tabs.Root
      value={value}
      onValueChange={onValueChange}
      className="space-y-4"
      data-no-pull-refresh="true"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { touchStartRef.current = undefined; }}
      onClickCapture={handleClickCapture}
    >
      <div
        className="sticky z-20 -mx-4 sm:-mx-6 lg:hidden"
        style={{
          top: chromeHidden
            ? 'env(safe-area-inset-top,0px)'
            : 'calc(env(safe-area-inset-top,0px)+var(--header-h,4rem))',
        } as CSSProperties}
      >
        <Tabs.List
          ref={tabsListRef}
          aria-label="Vistas de la biblioteca"
          className="library-pills-scrollbar bg-background flex gap-1.5 overflow-x-auto border-b border-border/50 px-4 pt-3 pb-2.5 sm:px-6"
        >
          <Tabs.Trigger value="reading" className={TRIGGER_CLASS}>
            Leyendo ({statusCounts.reading})
          </Tabs.Trigger>
          <Tabs.Trigger value="finished" className={TRIGGER_CLASS}>
            Leídos ({statusCounts.finished})
          </Tabs.Trigger>
          <Tabs.Trigger value="favorites" className={TRIGGER_CLASS}>
            Favoritos ({visibleFavorites.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="all" className={TRIGGER_CLASS}>
            Todos ({books.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="authors" className={TRIGGER_CLASS}>
            Autores
          </Tabs.Trigger>
          <Tabs.Trigger value="sagas" className={TRIGGER_CLASS}>
            Sagas
          </Tabs.Trigger>
          <Tabs.Trigger value="quotes" className={TRIGGER_CLASS}>
            Citas ({visibleQuotes.length})
          </Tabs.Trigger>
        </Tabs.List>
      </div>

      <div className="min-h-[45svh] w-full min-w-0 overflow-x-clip">
        <Tabs.Content value="reading" className="w-full min-w-0 focus-visible:outline-none data-[state=inactive]:hidden data-[state=active]:animate-[leeto-tab-fade_160ms_ease-out]">
          {visibleReading.length > 0 ? (
            <BookGrid books={visibleReading} onEdit={onEdit} onDelete={onDelete} />
          ) : (
            <NoResults message={query ? undefined : 'Sin libros en lectura.'} />
          )}
        </Tabs.Content>

        <Tabs.Content value="finished" className="w-full min-w-0 focus-visible:outline-none data-[state=inactive]:hidden data-[state=active]:animate-[leeto-tab-fade_160ms_ease-out]">
          {visibleFinished.length > 0 ? (
            <BookGrid books={visibleFinished} onEdit={onEdit} onDelete={onDelete} />
          ) : (
            <NoResults message={query ? undefined : 'Sin libros terminados.'} />
          )}
        </Tabs.Content>

        <Tabs.Content value="favorites" className="w-full min-w-0 focus-visible:outline-none data-[state=inactive]:hidden data-[state=active]:animate-[leeto-tab-fade_160ms_ease-out]">
          {visibleFavorites.length > 0 ? (
            <BookGrid books={visibleFavorites} onEdit={onEdit} onDelete={onDelete} />
          ) : (
            <NoResults message={query ? undefined : 'Marca favoritos desde el menú de cada portada.'} />
          )}
        </Tabs.Content>

        <Tabs.Content value="all" className="w-full min-w-0 focus-visible:outline-none data-[state=inactive]:hidden data-[state=active]:animate-[leeto-tab-fade_160ms_ease-out]">
          {visibleBooks.length > 0 ? (
            <BookGrid books={visibleBooks} onEdit={onEdit} onDelete={onDelete} />
          ) : (
            <NoResults />
          )}
        </Tabs.Content>

        <Tabs.Content value="authors" className="w-full min-w-0 space-y-5 focus-visible:outline-none data-[state=inactive]:hidden data-[state=active]:animate-[leeto-tab-fade_160ms_ease-out]">
          {visibleBooks.length > 0 ? (
            groupByAuthor(visibleBooks).map((group) => (
              <section key={group.key} aria-label={`Libros de ${group.label}`} className="space-y-2">
                <h3 className="text-sm font-medium">
                  {group.label} <span className="text-muted-foreground">({group.books.length})</span>
                </h3>
                <BookGrid books={group.books} onEdit={onEdit} onDelete={onDelete} />
              </section>
            ))
          ) : (
            <NoResults />
          )}
        </Tabs.Content>

        <Tabs.Content value="sagas" className="w-full min-w-0 space-y-5 focus-visible:outline-none data-[state=inactive]:hidden data-[state=active]:animate-[leeto-tab-fade_160ms_ease-out]">
          {visibleBooks.length > 0 ? (
            groupBySaga(visibleBooks).map((group) => (
              <section key={group.key} aria-label={`Saga ${group.label}`} className="space-y-2">
                <h3 className="text-sm font-medium">
                  {group.label} <span className="text-muted-foreground">({group.books.length})</span>
                </h3>
                <BookGrid books={group.books} onEdit={onEdit} onDelete={onDelete} />
              </section>
            ))
          ) : (
            <NoResults />
          )}
        </Tabs.Content>

        <Tabs.Content value="quotes" className="w-full min-w-0 focus-visible:outline-none data-[state=inactive]:hidden data-[state=active]:animate-[leeto-tab-fade_160ms_ease-out]">
          <QuoteList quotes={visibleQuotes} books={books} query={query} />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}
