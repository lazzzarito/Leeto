import {
  List,
  Pause,
  Play,
  Quote,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import type { PlayerClip } from '@/core/player/state';
import type { AppSettings, PlaybackState } from '@/types';
import PlayerSettingsDialog from './PlayerSettingsDialog';

interface PlayerControlsProps {
  status: PlaybackState;
  settings: AppSettings;
  clips: PlayerClip[];
  clipIndex: number;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (clipIndex: number) => void;
  onQuote: () => void;
  onToc: () => void;
}

const BUTTON_CLASS =
  'bg-card/80 border-border flex size-10 items-center justify-center rounded-full border transition-colors hover:bg-muted';

export default function PlayerControls({
  status,
  settings,
  clips,
  clipIndex,
  onToggle,
  onNext,
  onPrevious,
  onSeek,
  onQuote,
  onToc,
}: PlayerControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const playing = status === 'playing';

  return (
    <>
      <div className="space-y-3 border-t border-border bg-background/85 px-3 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrevious} aria-label="Bloque anterior" className={BUTTON_CLASS}>
            <SkipBack className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
            className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-full"
          >
            {playing ? (
              <Pause className="size-5" aria-hidden="true" />
            ) : (
              <Play className="size-5 translate-x-px" aria-hidden="true" />
            )}
          </button>
          <button type="button" onClick={onNext} aria-label="Bloque siguiente" className={BUTTON_CLASS}>
            <SkipForward className="size-4" aria-hidden="true" />
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, clips.length - 1)}
            value={Math.min(clipIndex, Math.max(0, clips.length - 1))}
            onChange={(event) => onSeek(Number(event.target.value))}
            aria-label="Posición en el libro"
            className="min-w-0 flex-1 accent-[hsl(var(--primary))]"
          />
          <button type="button" onClick={onQuote} aria-label="Guardar cita" className={BUTTON_CLASS}>
            <Quote className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onToc} aria-label="Abrir índice" className={BUTTON_CLASS}>
            <List className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Ajustes de lectura"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            className={BUTTON_CLASS}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <PlayerSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
      />
    </>
  );
}
