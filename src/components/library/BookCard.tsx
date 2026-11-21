import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { BookOpenText, Clock3, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '@/core/db/settings';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { useBookProgress } from '@/hooks/useLibrary';
import { estimateRemainingTime, formatDuration } from '@/lib/time';
import type { LeetoBook } from '@/types';

interface BookCardProps {
  book: LeetoBook;
  onEdit: (book: LeetoBook) => void;
  onDelete: (book: LeetoBook) => void;
}

const MENU_ITEM_CLASS =
  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus:bg-accent data-[highlighted]:bg-accent';

export default function BookCard({ book, onEdit, onDelete }: BookCardProps) {
  const coverUrl = useAssetUrl(book.coverAssetId);
  const progress = useBookProgress(book.id);
  const { wpm } = useSettings();

  const percentage = progress?.percentage ?? 0;
  const consumedWords = (book.totalWordCount * percentage) / 100;
  const remaining = estimateRemainingTime(book.totalWordCount, consumedWords, wpm);

  return (
    <li className="group relative rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20">
      <Link to={`/read/${book.id}`} className="block focus-visible:ring-2">
        <div className="bg-muted flex aspect-[2/3] items-center justify-center overflow-hidden rounded-lg">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`Portada de ${book.title}`}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <BookOpenText className="text-muted-foreground size-8" aria-hidden="true" />
          )}
        </div>

        <div className="mt-3 space-y-0.5">
          <h3 className="truncate text-sm font-medium" title={book.title}>
            {book.title}
          </h3>
          <p className="text-muted-foreground truncate text-xs" title={book.author}>
            {book.author}
          </p>
          {book.saga && (
            <p className="text-muted-foreground truncate text-xs">
              {book.saga}
              {typeof book.volumeNumber === 'number' ? ` · ${book.volumeNumber}` : ''}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{percentage.toFixed(0)}%</span>
          <span className="flex items-center gap-1">
            <Clock3 className="size-3" aria-hidden="true" />
            {formatDuration(remaining)}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div className="bg-primary h-full rounded-full" style={{ width: `${percentage}%` }} />
        </div>
      </Link>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Opciones de ${book.title}`}
            className="bg-card/90 border-border absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg border opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="bg-popover text-popover-foreground z-50 min-w-40 rounded-lg border border-border p-1 shadow-lg"
          >
            <DropdownMenu.Item
              className={MENU_ITEM_CLASS}
              onSelect={() => onEdit(book)}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Editar metadatos
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={`${MENU_ITEM_CLASS} text-destructive`}
              onSelect={() => onDelete(book)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Eliminar
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </li>
  );
}
