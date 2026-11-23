import { AudioLines, Pause, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlayerContext } from '@/core/player/PlayerProvider';
import { cn } from '@/lib/cn';

/** Indicador centrado del audio en curso; al tocarlo vuelve al lector. */
export default function PlayerNotch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { state, clip, book, bookId, toggle } = usePlayerContext();

  if (state.status !== 'playing' || !clip || !bookId) return null;

  return (
    <div
      role="status"
      aria-label="Reproduciendo audio"
      className={cn(
        'border-border bg-card/95 flex max-w-[15rem] items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 shadow-md backdrop-blur',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => navigate(`/read/${bookId}`)}
        aria-label={`Volver a ${book?.title ?? 'la lectura'}`}
        className="flex min-w-0 items-center gap-1.5"
      >
        <AudioLines className="text-primary size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate text-xs font-medium">{book?.title ?? 'Leeto'}</span>
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-label={state.status === 'playing' ? 'Pausar audio' : 'Reanudar audio'}
        className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full"
      >
        {state.status === 'playing' ? (
          <Pause className="size-3" aria-hidden="true" />
        ) : (
          <Play className="size-3" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
