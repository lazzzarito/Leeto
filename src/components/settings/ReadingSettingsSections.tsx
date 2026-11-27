import { ChevronDown, Star } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { booksRepo } from '@/core/db/repositories';
import { updateSettings, useSettings } from '@/core/db/settings';
import { listVoices } from '@/core/tts/driver';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';
import type { AppSettings, LeetoBook } from '@/types';

const FIELD_CLASS = 'flex flex-col gap-1.5 text-xs';
const FIELD_TITLE_CLASS = 'text-muted-foreground font-medium';
const CONTROL_CLASS = 'bg-background border-border h-9 rounded-lg border px-2.5 text-sm';
const RANGE_CLASS = 'accent-primary h-9 w-full';

/** Bloque plegable estilo FAQ, reutilizable en Configuración y en Ajustes de lectura. */
export function SettingsSection({
  title,
  description,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  /** Presente cuando varias secciones comparten un único estado de acordeón. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  return (
    <details
      open={isOpen}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (next === isOpen) return;
        if (open === undefined) setInternalOpen(next);
        onOpenChange?.(next);
      }}
      className="group rounded-xl border border-border bg-card"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          {description && (
            <span className="text-muted-foreground mt-0.5 block text-xs">{description}</span>
          )}
        </span>
        <ChevronDown
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-border/70 px-4 py-4">{children}</div>
    </details>
  );
}

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

/**
 * Ajustes de lectura como acordeón. Se monta por separado en el reproductor y
 * dentro del modal de Configuración, sin abrir un segundo diálogo.
 */
export default function ReadingSettingsSections({
  book,
  voices,
}: {
  book?: LeetoBook;
  voices?: SpeechSynthesisVoice[];
}) {
  const settings = useSettings();
  const { theme, setTheme, themeMode, setThemeMode, themes } = useTheme();
  const availableVoices = voices ?? listVoices();
  const [openSection, setOpenSection] = useState<string | undefined>('ritmo');
  const accordion = (id: string) => ({
    open: openSection === id,
    onOpenChange: (next: boolean) => setOpenSection(next ? id : undefined),
  });

  return (
    <div className="space-y-3">
      <SettingsSection {...accordion('ritmo')} title="Ritmo" description="Velocidad y duración de cada fragmento">
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
      </SettingsSection>

      <SettingsSection {...accordion('texto')} title="Texto" description="Tamaño y separación de líneas">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tamaño" value={`${settings.fontSize} px`}>
            <input
              type="range"
              min={14}
              max={32}
              value={settings.fontSize}
              onChange={(event) => void updateSettings({ fontSize: Number(event.target.value) })}
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
              onChange={(event) => void updateSettings({ lineHeight: Number(event.target.value) })}
              className={RANGE_CLASS}
            />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection {...accordion('apariencia')} title="Apariencia" description="Tema, modo y movimiento">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Tema">
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as AppSettings['readingTheme'])}
              className={CONTROL_CLASS}
            >
              {themes.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Modo">
            <select
              value={themeMode}
              onChange={(event) => setThemeMode(event.target.value as 'system' | 'manual')}
              className={CONTROL_CLASS}
            >
              <option value="system">Automático</option>
              <option value="manual">Manual</option>
            </select>
          </Field>
          <Field label="Movimiento">
            <select
              value={settings.reducedMotion ?? 'system'}
              onChange={(event) => void updateSettings({ reducedMotion: event.target.value as AppSettings['reducedMotion'] })}
              className={CONTROL_CLASS}
            >
              <option value="system">Sistema</option>
              <option value="on">Reducido</option>
              <option value="off">Normal</option>
            </select>
          </Field>
        </div>
        <label className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.kineticTextEnabled}
            onChange={(event) => void updateSettings({ kineticTextEnabled: event.target.checked })}
          />
          Resaltar la palabra activa
        </label>
      </SettingsSection>

      <SettingsSection {...accordion('voz')} title="Voz" description="Lectura en voz alta del dispositivo">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.ttsEnabled}
              onChange={(event) => void updateSettings({ ttsEnabled: event.target.checked })}
            />
            Leer en voz alta
          </label>
          {settings.ttsEnabled && availableVoices.length > 0 && (
            <Field label="Voz del sistema">
              <select
                value={settings.ttsVoiceURI ?? ''}
                onChange={(event) => void updateSettings({ ttsVoiceURI: event.target.value || undefined })}
                className={CONTROL_CLASS}
              >
                <option value="">Predeterminada</option>
                {availableVoices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </SettingsSection>

      {book && (
        <SettingsSection {...accordion('libro')} title="Libro" description={book.title}>
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
              className={cn('size-4', book.favorite ? 'text-primary fill-current' : 'text-muted-foreground')}
              aria-hidden="true"
            />
            <span className="flex-1 font-medium">
              {book.favorite ? 'Es favorito' : 'Marcar como favorito'}
            </span>
            <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', book.favorite ? 'bg-primary' : 'bg-muted')}>
              <span className={cn(
                'bg-background absolute top-0.5 left-0.5 size-5 rounded-full shadow transition-transform duration-200',
                book.favorite ? 'translate-x-[22px]' : 'translate-x-0',
              )} />
            </span>
          </button>
        </SettingsSection>
      )}
    </div>
  );
}
