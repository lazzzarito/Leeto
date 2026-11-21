import { BookOpenText, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '@/core/db/settings';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { useBookProgress } from '@/hooks/useLibrary';
import { estimateRemainingTime, formatDuration } from '@/lib/time';
import type { LeetoBook } from '@/types';

export default function BookCard({ book }: { book: LeetoBook }) {
  const coverUrl = useAssetUrl(book.coverAssetId);
  const progress = useBookProgress(book.id);
  const { wpm } = useSettings();

  const percentage = progress?.percentage ?? 0;
  const consumedWords = (book.totalWordCount * percentage) / 100;
  const remaining = estimateRemainingTime(book.totalWordCount, consumedWords, wpm);

  return (
    <li className="group rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20">
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
    </li>
  );
}
