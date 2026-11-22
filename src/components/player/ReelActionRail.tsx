import { Heart, List, Music2, Send, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ReelActionRailProps {
  title: string;
  quoteCount: number;
  ttsEnabled: boolean;
  playing: boolean;
  reducedMotion: boolean;
  heartPop: boolean;
  onQuote: () => void;
  onToc: () => void;
  onShare: () => void;
  onSettings: () => void;
  onToggleTts: () => void;
}

const BUTTON_CLASS =
  'border-white/25 bg-black/25 text-reel flex size-11 items-center justify-center rounded-full border backdrop-blur-sm transition-colors hover:bg-black/40';
const LABEL_CLASS = 'text-reel-muted text-[10px] leading-none';

export default function ReelActionRail({
  title,
  quoteCount,
  ttsEnabled,
  playing,
  reducedMotion,
  heartPop,
  onQuote,
  onToc,
  onShare,
  onSettings,
  onToggleTts,
}: ReelActionRailProps) {
  return (
    <aside
      aria-label="Acciones del lector"
      className={cn(
        'reel-rail-enter absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 flex items-center justify-center gap-2 px-4 md:gap-5',
        reducedMotion && 'reel-rail-static',
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" onClick={onShare} aria-label="Compartir fragmento" className="flex flex-col items-center gap-1">
        <span className={BUTTON_CLASS}>
          <Send className="size-5" aria-hidden="true" />
        </span>
        <span className={LABEL_CLASS} aria-hidden="true">Compartir</span>
      </button>

      <button type="button" onClick={onToc} aria-label="Abrir índice" className="flex flex-col items-center gap-1">
        <span className={BUTTON_CLASS}>
          <List className="size-5" aria-hidden="true" />
        </span>
        <span className={LABEL_CLASS} aria-hidden="true">Índice</span>
      </button>

      <button type="button" onClick={onQuote} aria-label="Guardar cita" className="flex flex-col items-center gap-1">
        <span className={cn(BUTTON_CLASS, 'size-12')}>
          <Heart
            className={cn(
              'size-6',
              heartPop && 'fill-rose-500 text-rose-500',
              heartPop && !reducedMotion && 'leeto-heart-pop',
            )}
            aria-hidden="true"
          />
        </span>
        <span className={LABEL_CLASS} aria-hidden="true">{quoteCount}</span>
      </button>

      <button
        type="button"
        onClick={onToggleTts}
        aria-label={ttsEnabled ? 'Desactivar voz local' : 'Activar voz local'}
        aria-pressed={ttsEnabled}
        className="flex flex-col items-center gap-1"
      >
        <span className={BUTTON_CLASS}>
          <Music2
            className={cn('size-5', ttsEnabled && playing && !reducedMotion && 'animate-spin')}
            aria-hidden="true"
          />
        </span>
        <span className={LABEL_CLASS} aria-hidden="true">Voz</span>
      </button>

      <button
        type="button"
        onClick={onSettings}
        aria-label={`Ajustes de lectura de ${title}`}
        className="flex flex-col items-center gap-1"
      >
        <span className={BUTTON_CLASS}>
          <SlidersHorizontal className="size-5" aria-hidden="true" />
        </span>
        <span className={LABEL_CLASS} aria-hidden="true">Ajustes</span>
      </button>
    </aside>
  );
}
