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
  const { theme, setTheme, themes } = useTheme();

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Configuración"
      description="Preferencias guardadas solo en este dispositivo."
    >
      <div className="space-y-8 pb-8">
        <section aria-labelledby="settings-theme-heading" className="space-y-3">
          <div>
            <h2 id="settings-theme-heading" className="text-base font-medium">
              Tema de lectura
            </h2>
            <p className="text-muted-foreground text-sm">Cada tema define todos los colores.</p>
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
