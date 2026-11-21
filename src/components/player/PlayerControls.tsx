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
import { updateSettings } from '@/core/db/settings';
import { useTheme } from '@/hooks/useTheme';
import type { AppSettings, PlaybackState } from '@/types';

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

const LABEL_CLASS = 'text-muted-foreground flex flex-col gap-1 text-xs';

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
  const [advanced, setAdvanced] = useState(false);
  const { theme, setTheme, themes } = useTheme();
  const playing = status === 'playing';

  return (
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
          onClick={() => setAdvanced((value) => !value)}
          aria-label="Más ajustes"
          aria-expanded={advanced}
          className={BUTTON_CLASS}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
        </button>
      </div>

      {advanced && (
        <section aria-label="Ajustes del reproductor" className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <label className={LABEL_CLASS}>
            Velocidad
            <select
              value={settings.playbackSpeed}
              onChange={(event) => void updateSettings({ playbackSpeed: Number(event.target.value) })}
              className="bg-background border-border h-8 rounded-md border px-2 text-sm"
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2, 2.5].map((speed) => (
                <option key={speed} value={speed}>
                  {speed}x
                </option>
              ))}
            </select>
          </label>

          <label className={LABEL_CLASS}>
            PPM
            <input
              type="number"
              min={60}
              max={1000}
              step={10}
              value={settings.wpm}
              onChange={(event) => void updateSettings({ wpm: Number(event.target.value) })}
              className="bg-background border-border h-8 rounded-md border px-2 text-sm"
            />
          </label>

          <label className={LABEL_CLASS}>
            Tamaño ({settings.fontSize}px)
            <input
              type="range"
              min={14}
              max={32}
              value={settings.fontSize}
              onChange={(event) => void updateSettings({ fontSize: Number(event.target.value) })}
            />
          </label>

          <label className={LABEL_CLASS}>
            Interlineado ({settings.lineHeight.toFixed(1)})
            <input
              type="range"
              min={1.3}
              max={2.2}
              step={0.1}
              value={settings.lineHeight}
              onChange={(event) => void updateSettings({ lineHeight: Number(event.target.value) })}
            />
          </label>

          <label className={LABEL_CLASS}>
            Tema
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as AppSettings['readingTheme'])}
              className="bg-background border-border h-8 rounded-md border px-2 text-sm"
            >
              {themes.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={LABEL_CLASS}>
            Movimiento reducido
            <select
              value={settings.reducedMotion ?? 'system'}
              onChange={(event) =>
                void updateSettings({
                  reducedMotion: event.target.value as AppSettings['reducedMotion'],
                })
              }
              className="bg-background border-border h-8 rounded-md border px-2 text-sm"
            >
              <option value="system">Sistema</option>
              <option value="on">Siempre</option>
              <option value="off">Nunca</option>
            </select>
          </label>

          <label className={LABEL_CLASS}>
            Duración imagen ({(settings.imageDurationMs ?? 6000) / 1000}s)
            <input
              type="range"
              min={3000}
              max={10000}
              step={1000}
              value={settings.imageDurationMs ?? 6000}
              onChange={(event) =>
                void updateSettings({ imageDurationMs: Number(event.target.value) })
              }
            />
          </label>

          <div className="flex flex-col justify-end gap-1.5 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.kineticTextEnabled}
                onChange={(event) =>
                  void updateSettings({ kineticTextEnabled: event.target.checked })
                }
              />
              Cinética Focus Playhead
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.ttsEnabled}
                onChange={(event) => void updateSettings({ ttsEnabled: event.target.checked })}
              />
              Voz local (TTS)
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
