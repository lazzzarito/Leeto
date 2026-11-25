import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { BookCheck, BookOpenText, Clock3, MoreHorizontal, Pencil, RotateCcw, Star, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Marquee from '@/components/ui/Marquee';
import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import { cn } from '@/lib/cn';
import { booksRepo, progressRepo } from '@/core/db/repositories';
import { useSettings } from '@/core/db/settings';
import { getReadingStatus } from '@/core/library/views';
import { notifyLocalSyncChange } from '@/core/sync/scheduler';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { useBookProgress } from '@/hooks/useLibrary';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatFileSize, formatFileType } from '@/lib/file';
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
  const { wpm, deviceId } = useSettings();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [actionsOpen, setActionsOpen] = useState(false);
  const { ref, span } = useRowSpan<HTMLLIElement>(coverUrl);

  const percentage = progress?.percentage ?? 0;
  const consumedWords = (book.totalWordCount * percentage) / 100;
  const remaining = estimateRemainingTime(book.totalWordCount, consumedWords, wpm);
  const status = getReadingStatus(progress);

  const markAsRead = async () => {
    // El último bloque real puede estar en un capítulo sin bloques al final.
    for (let chapterIndex = book.chapters.length - 1; chapterIndex >= 0; chapterIndex -= 1) {
      const blocks = book.chapters[chapterIndex]?.blocks ?? [];
      const lastBlock = blocks[blocks.length - 1];
      if (!lastBlock) continue;
      await progressRepo.put({
        bookId: book.id,
        chapterIndex,
        blockId: lastBlock.id,
        segmentIndex: 0,
        percentage: 100,
        updatedAt: Date.now(),
        deviceId,
        status: 'finished',
      });
      notifyLocalSyncChange();
      return;
    }
  };

  const markAsUnread = async () => {
    const now = Date.now();
    // Tombstone: borrar el registro local dejaría que el sync restaurara "leído".
    await progressRepo.put({
      bookId: book.id,
      chapterIndex: progress?.chapterIndex ?? 0,
      blockId: progress?.blockId ?? book.chapters[0]?.blocks[0]?.id ?? '',
      segmentIndex: progress?.segmentIndex ?? 0,
      percentage: 0,
      updatedAt: now,
      deviceId,
      deletedAt: now,
      status: 'unread',
    });
    notifyLocalSyncChange();
  };

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
          <h3 className="flex items-center gap-1.5 text-sm font-medium" title={book.title}>
            <Marquee text={book.title} />
            {book.favorite && (
              <Star className="text-primary size-3.5 shrink-0 fill-current" aria-label="Favorito" />
            )}
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
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
              {formatFileType(book.mimeType)}
            </span>
            <span className="text-muted-foreground text-[11px]">{formatFileSize(book.fileSize)}</span>
          </div>
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

      {isDesktop ? (
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
              className="bg-popover text-popover-foreground z-50 min-w-40 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-lg border border-border p-1 shadow-lg data-[state=open]:animate-[leeto-pop-in_160ms_ease-out] data-[state=closed]:animate-[leeto-pop-out_120ms_ease-in]"
            >
              <DropdownMenu.Item className={MENU_ITEM_CLASS} onSelect={() => void booksRepo.toggleFavorite(book.id)}>
                <Star className={cn('size-4', book.favorite && 'text-primary fill-current')} aria-hidden="true" />
                {book.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              </DropdownMenu.Item>
              <DropdownMenu.Item className={MENU_ITEM_CLASS} onSelect={() => void (status === 'finished' ? markAsUnread() : markAsRead())}>
                {status === 'finished' ? <RotateCcw className="size-4" aria-hidden="true" /> : <BookCheck className="size-4" aria-hidden="true" />}
                {status === 'finished' ? 'Marcar como no leído' : 'Marcar como leído'}
              </DropdownMenu.Item>
              <DropdownMenu.Item className={MENU_ITEM_CLASS} onSelect={() => onEdit(book)}>
                <Pencil className="size-4" aria-hidden="true" />
                Editar metadatos
              </DropdownMenu.Item>
              <DropdownMenu.Item className={`${MENU_ITEM_CLASS} text-destructive`} onSelect={() => onDelete(book)}>
                <Trash2 className="size-4" aria-hidden="true" />
                Eliminar
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : (
        <>
          <button
            type="button"
            aria-label={`Opciones de ${book.title}`}
            onClick={() => setActionsOpen(true)}
            className="bg-card/90 border-border absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg border"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
          <ResponsiveDialog
            open={actionsOpen}
            onOpenChange={setActionsOpen}
            height="content"
            variant="centered"
            title="Acciones del libro"
          >
            <div className="space-y-1 pb-6">
              <button type="button" className="hover:bg-accent flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm" onClick={() => { setActionsOpen(false); void booksRepo.toggleFavorite(book.id); }}>
                <Star className={cn('size-4', book.favorite && 'text-primary fill-current')} aria-hidden="true" />
                {book.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              </button>
              <button type="button" className="hover:bg-accent flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm" onClick={() => { setActionsOpen(false); void (status === 'finished' ? markAsUnread() : markAsRead()); }}>
                {status === 'finished' ? <RotateCcw className="size-4" aria-hidden="true" /> : <BookCheck className="size-4" aria-hidden="true" />}
                {status === 'finished' ? 'Marcar como no leído' : 'Marcar como leído'}
              </button>
              <button type="button" className="hover:bg-accent flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm" onClick={() => { setActionsOpen(false); onEdit(book); }}>
                <Pencil className="size-4" aria-hidden="true" />
                Editar metadatos
              </button>
              <button type="button" className="text-destructive hover:bg-accent flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm" onClick={() => { setActionsOpen(false); onDelete(book); }}>
                <Trash2 className="size-4" aria-hidden="true" />
                Eliminar
              </button>
            </div>
          </ResponsiveDialog>
        </>
      )}
    </li>
  );
}
