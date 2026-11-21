import * as Dialog from '@radix-ui/react-dialog';
import { Check, X } from 'lucide-react';
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'bg-background fixed inset-x-0 bottom-0 z-50 flex h-[90dvh] w-full flex-col overflow-hidden',
            'rounded-t-2xl border border-border shadow-2xl outline-none',
            'md:inset-x-auto md:inset-y-0 md:right-0 md:h-dvh md:w-1/2 md:rounded-none md:border-r-0 md:border-y-0',
          )}
        >
          <header className="pt-safe border-b border-border/70 bg-background/95 shrink-0 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-semibold tracking-tight">
                  Configuración
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground truncate text-xs">
                  Preferencias guardadas solo en este dispositivo.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Cerrar configuración"
                  className="hover:bg-muted flex size-10 shrink-0 items-center justify-center rounded-full transition-colors"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          </header>

          <div className="scroll-touch min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 sm:px-6">
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
          </div>
          <div className="pb-safe bg-background shrink-0" aria-hidden="true" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
