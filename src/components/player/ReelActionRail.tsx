import { List, Quote, Send, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ReelActionRailProps {
  title: string;
  ttsEnabled: boolean;
  playing: boolean;
  reducedMotion: boolean;
  quoteCaptured: boolean;
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
  ttsEnabled,
  playing,
  reducedMotion,
  quoteCaptured,
  onQuote,
  onToc,
  onShare,
  onSettings,
  onToggleTts,
}: ReelActionRailProps) {
  const listening = ttsEnabled && playing;

  return (
    <aside
      aria-label="Acciones del lector"
      className={cn(
        'reel-rail-enter absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 flex items-center justify-between gap-1 px-4 md:px-10',
        reducedMotion && 'reel-rail-static',
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={onShare}
        aria-label="Compartir fragmento actual"
        title="Comparte este fragmento con el título y autor del libro"
        className="flex flex-col items-center gap-1"
      >
        <span className={BUTTON_CLASS}>
          <Send className="size-5" aria-hidden="true" />
        </span>
        <span className={LABEL_CLASS} aria-hidden="true">Compartir</span>
      </button>

      <button type="button" onClick={onQuote} aria-label="Guardar cita" className="flex flex-col items-center gap-1">
        <span className={cn(BUTTON_CLASS, 'relative size-12 overflow-hidden')}>
          <Quote
            className={cn('size-6', quoteCaptured && !reducedMotion && 'leeto-quote-icon')}
            aria-hidden="true"
          />
          {quoteCaptured && !reducedMotion && (
            <span className="leeto-quote-capture" aria-hidden="true" />
          )}
        </span>
        <span className={LABEL_CLASS} aria-hidden="true">Cita</span>
      </button>

      <button type="button" onClick={onToc} aria-label="Abrir índice" className="flex flex-col items-center gap-1">
        <span className={BUTTON_CLASS}>
          <List className="size-5" aria-hidden="true" />
        </span>
        <span className={LABEL_CLASS} aria-hidden="true">Índice</span>
      </button>

      <button
        type="button"
        onClick={onToggleTts}
        aria-label={ttsEnabled ? 'Desactivar voz local' : 'Activar voz local'}
        aria-pressed={ttsEnabled}
        className="flex flex-col items-center gap-1"
      >
        <span className={BUTTON_CLASS}>
          {listening ? (
            reducedMotion ? (
              <Volume2 className="size-5" aria-hidden="true" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 5 6 9H2v6h4l5 4z" />
                <path className="reel-speaker-wave reel-speaker-wave-1" d="M15 9.5a3.5 3.5 0 0 1 0 5" />
                <path className="reel-speaker-wave reel-speaker-wave-2" d="M18 7a7 7 0 0 1 0 10" />
                <path className="reel-speaker-wave reel-speaker-wave-3" d="M21 4.5a10.5 10.5 0 0 1 0 15" />
              </svg>
            )
          ) : (
            <VolumeX className="size-5" aria-hidden="true" />
          )}
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
