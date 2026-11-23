import { Check } from 'lucide-react';
import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';
import SyncSettings from './SyncSettings';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Configuración como modal: hoja inferior en móvil y panel lateral en pantallas anchas. */
export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme, themeMode, setThemeMode, themes } = useTheme();

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Configuración"
      description="Preferencias guardadas solo en este dispositivo."
    >
      <div className="space-y-6 pb-8">
        <section
          aria-labelledby="settings-theme-heading"
          className="space-y-4 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="settings-theme-heading" className="text-base font-medium">
                Apariencia
              </h2>
              <p className="text-muted-foreground text-sm">
                {themeMode === 'system'
                  ? `Tema automático según tu dispositivo (${theme === 'oled' ? 'oscuro' : 'claro'}).`
                  : 'Tema fijado manualmente.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={themeMode === 'system'}
              aria-label="Seguir el tema del dispositivo"
              onClick={() => setThemeMode(themeMode === 'system' ? 'manual' : 'system')}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                themeMode === 'system' ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'bg-background absolute top-0.5 size-5 rounded-full shadow transition-transform',
                  themeMode === 'system' ? 'translate-x-5.5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {themes.map((option) => {
              const selected = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    'relative rounded-xl border p-3 text-left transition-colors',
                    selected
                      ? 'border-primary bg-accent'
                      : 'border-border bg-card hover:border-foreground/30',
                  )}
                >
                  <span
                    className="mb-3 flex h-12 items-center justify-center rounded-lg border border-black/10 text-lg font-semibold"
                    style={{
                      backgroundColor: option.swatch[0],
                      color: option.swatch[1],
                    }}
                    aria-hidden="true"
                  >
                    Aa
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {option.label}
                    {selected && <Check className="text-primary size-3.5" aria-hidden="true" />}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">{option.hint}</span>
                  <span
                    className="mt-2 block h-1 w-8 rounded-full"
                    style={{ backgroundColor: option.swatch[2] }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </section>

        <SyncSettings />
      </div>
    </ResponsiveDialog>
  );
}
