import * as Tabs from '@radix-ui/react-tabs';
import {
  countBooksByStatus,
  filterBooks,
  filterBooksByFavorite,
  filterBooksByStatus,
  filterQuotes,
  groupByAuthor,
  groupBySaga,
} from '@/core/library/views';
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
  const statusCounts = countBooksByStatus(progressByBook);
  const visibleBooks = filterBooks(books, query);
  const visibleReading = filterBooksByStatus(visibleBooks, progressByBook, 'reading');
  const visibleFinished = filterBooksByStatus(visibleBooks, progressByBook, 'finished');
  const visibleFavorites = filterBooksByFavorite(visibleBooks);
  const visibleQuotes = filterQuotes(quotes, query);

  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className="space-y-4">
      <Tabs.List
        aria-label="Vistas de la biblioteca"
        className="bg-background/85 sticky top-[calc(env(safe-area-inset-top,0px)+var(--header-h,4rem))] z-20 flex w-full gap-1.5 overflow-x-auto px-1 pt-3 pb-2.5 backdrop-blur lg:hidden"
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
          Citas ({quotes.length})
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="reading" className="focus-visible:outline-none">
        {visibleReading.length > 0 ? (
          <BookGrid books={visibleReading} onEdit={onEdit} onDelete={onDelete} />
        ) : (
          <NoResults message={query ? undefined : 'Sin libros en lectura.'} />
        )}
      </Tabs.Content>

      <Tabs.Content value="finished" className="focus-visible:outline-none">
        {visibleFinished.length > 0 ? (
          <BookGrid books={visibleFinished} onEdit={onEdit} onDelete={onDelete} />
        ) : (
          <NoResults message={query ? undefined : 'Sin libros terminados.'} />
        )}
      </Tabs.Content>

      <Tabs.Content value="favorites" className="focus-visible:outline-none">
        {visibleFavorites.length > 0 ? (
          <BookGrid books={visibleFavorites} onEdit={onEdit} onDelete={onDelete} />
        ) : (
          <NoResults
            message={query ? undefined : 'Marca favoritos desde el menú de cada portada.'}
          />
        )}
      </Tabs.Content>

      <Tabs.Content value="all" className="focus-visible:outline-none">
        {visibleBooks.length > 0 ? (
          <BookGrid books={visibleBooks} onEdit={onEdit} onDelete={onDelete} />
        ) : (
          <NoResults />
        )}
      </Tabs.Content>

      <Tabs.Content value="authors" className="space-y-5 focus-visible:outline-none">
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

      <Tabs.Content value="sagas" className="space-y-5 focus-visible:outline-none">
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

      <Tabs.Content value="quotes" className="focus-visible:outline-none">
        <QuoteList quotes={visibleQuotes} books={books} query={query} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
