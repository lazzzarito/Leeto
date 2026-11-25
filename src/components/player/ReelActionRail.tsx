import { List, Quote, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/cn';

interface ReelActionRailProps {
  title: string;
  ttsEnabled: boolean;
  playing: boolean;
  reducedMotion: boolean;
  quoteCaptured: boolean;
  onQuote: () => void;
  onToc: () => void;
  onSettings: () => void;
  onToggleTts: () => void;
}

const PILL_CLASS =
  'border-white/25 bg-black/25 text-reel inline-flex h-10 min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium backdrop-blur-sm transition-colors hover:bg-black/40 sm:gap-2 sm:px-3.5 sm:text-xs';

const ReelActionRail = memo(function ReelActionRail({
  title,
  ttsEnabled,
  playing,
  reducedMotion,
  quoteCaptured,
  onQuote,
  onToc,
  onSettings,
  onToggleTts,
}: ReelActionRailProps) {
  const voiceOn = ttsEnabled;
  const listening = ttsEnabled && playing;

  return (
    <aside
      aria-label="Acciones del lector"
      data-player-action="true"
      className={cn(
        'reel-rail-enter absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 flex flex-nowrap items-center justify-center gap-1 px-2 sm:gap-2 sm:px-4',
        reducedMotion && 'reel-rail-static',
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" onClick={onQuote} aria-label="Guardar cita" className={cn(PILL_CLASS, 'relative overflow-hidden')}>
        <Quote className={cn('size-4', quoteCaptured && !reducedMotion && 'leeto-quote-icon')} aria-hidden="true" />
        {quoteCaptured && !reducedMotion && <span className="leeto-quote-capture" aria-hidden="true" />}
        <span className="hidden min-[360px]:inline">Cita</span>
      </button>

      <button type="button" onClick={onToc} aria-label="Abrir índice" className={PILL_CLASS}>
        <List className="size-4" aria-hidden="true" />
        <span className="hidden min-[360px]:inline">Índice</span>
      </button>

      <button
        type="button"
        onClick={onToggleTts}
        aria-label={ttsEnabled ? 'Desactivar voz' : 'Activar voz'}
        aria-pressed={ttsEnabled}
        className={PILL_CLASS}
      >
        {voiceOn ? (
          listening && !reducedMotion ? (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4z" />
              <path className="reel-speaker-wave reel-speaker-wave-1" d="M15 9.5a3.5 3.5 0 0 1 0 5" />
              <path className="reel-speaker-wave reel-speaker-wave-2" d="M18 7a7 7 0 0 1 0 10" />
              <path className="reel-speaker-wave reel-speaker-wave-3" d="M21 4.5a10.5 10.5 0 0 1 0 15" />
            </svg>
          ) : (
            <span className={cn(!reducedMotion && 'leeto-voice-pulse inline-flex')} aria-hidden="true">
              <Volume2 className="size-4" />
            </span>
          )
        ) : (
          <VolumeX className="size-4" aria-hidden="true" />
        )}
        <span className="hidden min-[360px]:inline">Voz</span>
      </button>

      <button type="button" onClick={onSettings} aria-label={`Ajustes de lectura de ${title}`} className={PILL_CLASS}>
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        <span className="hidden min-[360px]:inline">Ajustes</span>
      </button>
    </aside>
  );
});

export default ReelActionRail;
