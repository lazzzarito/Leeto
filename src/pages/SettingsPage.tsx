import { Check } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';

export default function SettingsPage() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="space-y-8">
      <section className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground text-sm">
          Preferencias que se guardan solo en este dispositivo.
        </p>
      </section>

      <section aria-labelledby="theme-heading" className="space-y-3">
        <div>
          <h2 id="theme-heading" className="text-base font-medium">
            Tema de lectura
          </h2>
          <p className="text-muted-foreground text-sm">Cada tema define todos los colores.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

      <section aria-labelledby="upcoming-heading" className="space-y-2 border-t border-border pt-6">
        <h2 id="upcoming-heading" className="text-base font-medium">
          Próximamente
        </h2>
        <ul className="text-muted-foreground list-inside list-disc text-sm">
          <li>Tipografía, interlineado y PPM por defecto.</li>
          <li>Cinética Focus Playhead y lectura estática.</li>
          <li>Voz local (TTS) con fallback a temporizador.</li>
          <li>Sincronización WebDAV y carpeta local.</li>
        </ul>
      </section>
    </div>
  );
}
