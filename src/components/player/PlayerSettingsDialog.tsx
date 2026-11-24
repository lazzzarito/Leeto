import * as Tabs from '@radix-ui/react-tabs';
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
const TAB_TRIGGER_CLASS =
  'bg-muted/60 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 py-1.5 text-xs font-medium transition-colors';

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
    >
      <Tabs.Root defaultValue="ritmo" className="pb-8">
        <Tabs.List aria-label="Secciones de ajustes" className="sticky top-0 z-10 -mx-4 mb-4 flex gap-2 overflow-x-auto bg-background px-4 pb-2 sm:-mx-6 sm:px-6">
          <Tabs.Trigger value="ritmo" className={TAB_TRIGGER_CLASS}>Ritmo</Tabs.Trigger>
          <Tabs.Trigger value="texto" className={TAB_TRIGGER_CLASS}>Texto</Tabs.Trigger>
          <Tabs.Trigger value="apariencia" className={TAB_TRIGGER_CLASS}>Apariencia</Tabs.Trigger>
          <Tabs.Trigger value="voz" className={TAB_TRIGGER_CLASS}>Voz</Tabs.Trigger>
          <Tabs.Trigger value="libro" className={TAB_TRIGGER_CLASS}>Libro</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="ritmo" className="space-y-4">
          <Section title="Ritmo">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Velocidad">
                <select
                  value={settings.playbackSpeed}
                  onChange={(event) => void updateSettings({ playbackSpeed: Number(event.target.value) })}
                  className={CONTROL_CLASS}
                >
                  {[0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2].map((speed) => (
                    <option key={speed} value={speed}>{speed}x</option>
                  ))}
                </select>
              </Field>
              <Field label="PPM" value={`${settings.wpm}`}>
                <input
                  type="number"
                  min={120}
                  max={400}
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
                  onChange={(event) => void updateSettings({ imageDurationMs: Number(event.target.value) })}
                  className={RANGE_CLASS}
                />
              </Field>
            </div>
          </Section>
        </Tabs.Content>

        <Tabs.Content value="texto" className="space-y-4">
          <Section title="Texto">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tamaño" value={`${settings.fontSize} px`}>
                <input type="range" min={14} max={32} value={settings.fontSize} onChange={(e) => void updateSettings({ fontSize: Number(e.target.value) })} className={RANGE_CLASS} />
              </Field>
              <Field label="Interlineado" value={settings.lineHeight.toFixed(1)}>
                <input type="range" min={1.3} max={2.2} step={0.1} value={settings.lineHeight} onChange={(e) => void updateSettings({ lineHeight: Number(e.target.value) })} className={RANGE_CLASS} />
              </Field>
            </div>
          </Section>
        </Tabs.Content>

        <Tabs.Content value="apariencia" className="space-y-4">
          <Section title="Apariencia">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Tema">
                <select value={theme} onChange={(e) => setTheme(e.target.value as AppSettings['readingTheme'])} className={CONTROL_CLASS}>
                  {themes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Modo">
                <select value={themeMode} onChange={(e) => setThemeMode(e.target.value as 'system' | 'manual')} className={CONTROL_CLASS}>
                  <option value="system">Automático</option>
                  <option value="manual">Manual</option>
                </select>
              </Field>
              <Field label="Movimiento">
                <select value={settings.reducedMotion ?? 'system'} onChange={(e) => void updateSettings({ reducedMotion: e.target.value as AppSettings['reducedMotion'] })} className={CONTROL_CLASS}>
                  <option value="system">Sistema</option>
                  <option value="on">Reducido</option>
                  <option value="off">Normal</option>
                </select>
              </Field>
            </div>
            <label className="text-muted-foreground flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.kineticTextEnabled} onChange={(e) => void updateSettings({ kineticTextEnabled: e.target.checked })} />
              Resaltar la palabra activa
            </label>
          </Section>
        </Tabs.Content>

        <Tabs.Content value="voz" className="space-y-4">
          <Section title="Voz">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-muted-foreground flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.ttsEnabled} onChange={(e) => void updateSettings({ ttsEnabled: e.target.checked })} />
                Leer en voz alta
              </label>
              {settings.ttsEnabled && voices.length > 0 && (
                <Field label="Voz del sistema">
                  <select value={settings.ttsVoiceURI ?? ''} onChange={(e) => void updateSettings({ ttsVoiceURI: e.target.value || undefined })} className={CONTROL_CLASS}>
                    <option value="">Predeterminada</option>
                    {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
                  </select>
                </Field>
              )}
            </div>
          </Section>
        </Tabs.Content>

        <Tabs.Content value="libro" className="space-y-4">
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
            <Star className={cn('size-4', book.favorite ? 'text-primary fill-current' : 'text-muted-foreground')} aria-hidden="true" />
            <span className="flex-1 font-medium">{book.favorite ? 'Es favorito' : 'Marcar como favorito'}</span>
            <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', book.favorite ? 'bg-primary' : 'bg-muted')}>
              <span className={cn('bg-background absolute top-0.5 left-0.5 size-5 rounded-full shadow transition-transform duration-200', book.favorite ? 'translate-x-[22px]' : 'translate-x-0')} />
            </span>
          </button>
        </Tabs.Content>
      </Tabs.Root>
    </ResponsiveDialog>
  );
}
