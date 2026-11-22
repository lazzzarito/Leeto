import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import { updateSettings } from '@/core/db/settings';
import { useTheme } from '@/hooks/useTheme';
import type { AppSettings } from '@/types';

interface PlayerSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
}

const LABEL_CLASS = 'text-muted-foreground flex flex-col gap-1 text-xs';
const CONTROL_CLASS = 'bg-background border-border h-8 rounded-md border px-2 text-sm';

/** Ajustes del reproductor en el mismo modal responsive que el resto de la app. */
export default function PlayerSettingsDialog({
  open,
  onOpenChange,
  settings,
}: PlayerSettingsDialogProps) {
  const { theme, setTheme, themeMode, setThemeMode, themes } = useTheme();

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      height="content"
      title="Ajustes de lectura"
      description="Ritmo, tipografía y apariencia del reproductor."
    >
      <section
        aria-label="Ajustes del reproductor"
        className="grid grid-cols-2 gap-x-4 gap-y-3 pb-8 sm:grid-cols-3"
      >
        <label className={LABEL_CLASS}>
          Velocidad
          <select
            value={settings.playbackSpeed}
            onChange={(event) => void updateSettings({ playbackSpeed: Number(event.target.value) })}
            className={CONTROL_CLASS}
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
            className={CONTROL_CLASS}
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
            className={CONTROL_CLASS}
          >
            {themes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          Modo de tema
          <select
            value={themeMode}
            onChange={(event) => setThemeMode(event.target.value as 'system' | 'manual')}
            className={CONTROL_CLASS}
          >
            <option value="system">Automático</option>
            <option value="manual">Manual</option>
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
            className={CONTROL_CLASS}
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

        <div className="col-span-2 flex flex-col justify-end gap-1.5 text-xs sm:col-span-3">
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
    </ResponsiveDialog>
  );
}
