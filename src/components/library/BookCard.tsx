import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { BookOpenText, Clock3, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Marquee from '@/components/ui/Marquee';
import { cn } from '@/lib/cn';
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

const ROW_HEIGHT_PX = 8;
const ROW_GAP_PX = 8;

/** Masonry con grid: cada tarjeta ocupa las filas que necesita su altura real. */
function useRowSpan<T extends HTMLElement>(dependency: unknown) {
  const ref = useRef<T>(null);
  const [span, setSpan] = useState(18);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const height = element.getBoundingClientRect().height;
      setSpan(Math.max(1, Math.ceil((height + ROW_GAP_PX) / (ROW_HEIGHT_PX + ROW_GAP_PX))));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [dependency]);

  return { ref, span };
}

export default function BookCard({ book, onEdit, onDelete }: BookCardProps) {
  const coverUrl = useAssetUrl(book.coverAssetId);
  const progress = useBookProgress(book.id);
  const { wpm } = useSettings();
  const { ref, span } = useRowSpan<HTMLLIElement>(coverUrl);

  const percentage = progress?.percentage ?? 0;
  const consumedWords = (book.totalWordCount * percentage) / 100;
  const remaining = estimateRemainingTime(book.totalWordCount, consumedWords, wpm);

  return (
    <li
      ref={ref}
      style={{ gridRowEnd: `span ${span}` }}
      className="group relative self-start rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20"
    >
      <Link to={`/read/${book.id}`} className="block focus-visible:ring-2">
        <div
          className={cn(
            'bg-muted flex w-full items-center justify-center overflow-hidden rounded-lg',
            !coverUrl && 'aspect-[2/3]',
          )}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`Portada de ${book.title}`}
              className="h-auto max-h-96 w-full object-contain"
              loading="lazy"
            />
          ) : (
            <BookOpenText className="text-muted-foreground size-8" aria-hidden="true" />
          )}
        </div>

        <div className="mt-3 space-y-0.5">
          <h3 className="text-sm font-medium" title={book.title}>
            <Marquee text={book.title} />
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
