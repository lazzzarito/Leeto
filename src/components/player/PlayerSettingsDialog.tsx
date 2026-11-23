import { Star } from 'lucide-react';
import type { ReactNode } from 'react';
import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import { booksRepo } from '@/core/db/repositories';
import { updateSettings } from '@/core/db/settings';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';
import type { AppSettings, LeetoBook } from '@/types';

interface PlayerSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  book: LeetoBook;
  voices?: SpeechSynthesisVoice[];
}

const FIELD_CLASS = 'flex flex-col gap-1.5 text-xs';
const FIELD_TITLE_CLASS = 'text-muted-foreground font-medium';
const CONTROL_CLASS = 'bg-background border-border h-9 rounded-lg border px-2.5 text-sm';
const RANGE_CLASS = 'accent-primary h-9 w-full';

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <label className={FIELD_CLASS}>
      <span className={FIELD_TITLE_CLASS}>
        {label}
        {value && <span className="text-foreground"> · {value}</span>}
      </span>
      {children}
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Ajustes del reproductor agrupados por lo que afectan: ritmo, texto, voz y libro. */
export default function PlayerSettingsDialog({
  open,
  onOpenChange,
  settings,
  book,
  voices = [],
}: PlayerSettingsDialogProps) {
  const { theme, setTheme, themeMode, setThemeMode, themes } = useTheme();

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      height="content"
      title="Ajustes de lectura"
      description="Opciones de lectura."
    >
      <div className="divide-border space-y-6 pb-8">
        <Section title="Ritmo" description="Duración de cada fragmento.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Velocidad">
              <select
                value={settings.playbackSpeed}
                onChange={(event) =>
                  void updateSettings({ playbackSpeed: Number(event.target.value) })
                }
                className={CONTROL_CLASS}
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2, 2.5].map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}x
                  </option>
                ))}
              </select>
            </Field>
            <Field label="PPM" value="palabras por minuto">
              <input
                type="number"
                min={60}
                max={1000}
                step={10}
                value={settings.wpm}
                onChange={(event) => void updateSettings({ wpm: Number(event.target.value) })}
                className={CONTROL_CLASS}
              />
            </Field>
            <Field label="Imágenes" value={`${((settings.imageDurationMs ?? 6000) / 1000).toFixed(0)} s`}>
              <input
                type="range"
                min={3000}
                max={10000}
                step={1000}
                value={settings.imageDurationMs ?? 6000}
                onChange={(event) =>
                  void updateSettings({ imageDurationMs: Number(event.target.value) })
                }
                className={RANGE_CLASS}
              />
            </Field>
          </div>
        </Section>

        <Section title="Texto" description="Tamaño y separación del contenido.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tamaño" value={`${settings.fontSize} px`}>
              <input
                type="range"
                min={14}
                max={32}
                value={settings.fontSize}
                onChange={(event) =>
                  void updateSettings({ fontSize: Number(event.target.value) })
                }
                className={RANGE_CLASS}
              />
            </Field>
            <Field label="Interlineado" value={settings.lineHeight.toFixed(1)}>
              <input
                type="range"
                min={1.3}
                max={2.2}
                step={0.1}
                value={settings.lineHeight}
                onChange={(event) =>
                  void updateSettings({ lineHeight: Number(event.target.value) })
                }
                className={RANGE_CLASS}
              />
            </Field>
          </div>
        </Section>

        <Section title="Apariencia" description="Tema y movimiento de la interfaz.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Tema">
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
            </Field>
            <Field label="Modo de tema">
              <select
                value={themeMode}
                onChange={(event) => setThemeMode(event.target.value as 'system' | 'manual')}
                className={CONTROL_CLASS}
              >
                <option value="system">Automático</option>
                <option value="manual">Manual</option>
              </select>
            </Field>
            <Field label="Movimiento reducido">
              <select
                value={settings.reducedMotion ?? 'system'}
                onChange={(event) =>
                  void updateSettings({
                    reducedMotion: event.target.value as AppSettings['reducedMotion'],
                  })
                }
                className={CONTROL_CLASS}
              >
                <option value="system">Según el sistema</option>
                <option value="on">Siempre</option>
                <option value="off">Nunca</option>
              </select>
            </Field>
          </div>
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.kineticTextEnabled}
              onChange={(event) =>
                void updateSettings({ kineticTextEnabled: event.target.checked })
              }
            />
            Resaltar la palabra activa
          </label>
        </Section>

        <Section title="Voz" description="Voz del dispositivo.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-muted-foreground flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.ttsEnabled}
                onChange={(event) => void updateSettings({ ttsEnabled: event.target.checked })}
              />
              Leer en voz alta
            </label>
            {settings.ttsEnabled && voices.length > 0 && (
              <Field label="Voz del sistema">
                <select
                  value={settings.ttsVoiceURI ?? ''}
                  onChange={(event) =>
                    void updateSettings({ ttsVoiceURI: event.target.value || undefined })
                  }
                  className={CONTROL_CLASS}
                >
                  <option value="">Predeterminada</option>
                  {voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </Section>

        <Section title="Este libro">
          <button
            type="button"
            role="switch"
            aria-checked={book.favorite === true}
            onClick={() => void booksRepo.toggleFavorite(book.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
              book.favorite ? 'border-primary/40 bg-primary/10' : 'border-border hover:bg-muted',
            )}
          >
            <Star
              className={cn(
                'size-4',
                book.favorite ? 'text-primary fill-current' : 'text-muted-foreground',
              )}
              aria-hidden="true"
            />
            <span className="flex-1 font-medium">
              {book.favorite ? 'Es favorito' : 'Marcar como favorito'}
            </span>
            <span
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                book.favorite ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'bg-background absolute top-0.5 size-5 rounded-full shadow transition-transform',
                  book.favorite ? 'translate-x-5.5' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>
        </Section>
      </div>
    </ResponsiveDialog>
  );
}
