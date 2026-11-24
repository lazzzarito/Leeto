import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ListTree,
  Quote,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface OnboardingProps {
  onFinish: () => void;
}

const FEATURES = [
  {
    Icon: ChevronUp,
    title: 'Desliza y sigue',
    detail: 'Sube o baja para cambiar de fragmento sin perder el hilo.',
    className: 'onboard-gesture-up',
  },
  {
    Icon: Quote,
    title: 'Captura citas',
    detail: 'Doble toque, o el botón Cita, guarda el fragmento exacto que estás leyendo.',
    className: 'onboard-gesture-pop',
  },
  {
    Icon: ListTree,
    title: 'Índice y voz',
    detail: 'Navega por capítulos reales o escucha con voz local.',
    className: 'onboard-gesture-float',
  },
] as const;

/** Recorrido de primer uso: bienvenida y gestos del lector. */
export default function Onboarding({ onFinish }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(root.parentElement?.children ?? []).filter((node) => node !== root);
    siblings.forEach((node) => node.setAttribute('inert', ''));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.querySelector<HTMLElement>('button')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onFinish();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea'),
      ).filter((node) => node.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      siblings.forEach((node) => node.removeAttribute('inert'));
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onFinish]);

  return (
    <div
      ref={rootRef}
      data-onboarding
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="bg-background fixed inset-0 z-[110] flex flex-col overflow-hidden"
    >
      <div className="pointer-events-none absolute -top-24 -left-20 size-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 size-80 rounded-full bg-primary/10 blur-3xl" />
      <Sparkles
        className="text-primary/20 onboard-gesture-float absolute top-24 right-10 size-16"
        aria-hidden="true"
      />
      <img
        src="/icons/icon-192.webp"
        alt=""
        aria-hidden="true"
        width={48}
        height={48}
        className="onboard-gesture-pop absolute bottom-28 left-8 size-12 rounded-xl object-contain opacity-40"
      />

      <div className="relative flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((current) => current - 1)}
            aria-label="Paso anterior"
            className="hover:bg-muted flex size-10 items-center justify-center rounded-full transition-colors"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <span className="w-10" />
        )}

        <div className="flex gap-2" role="group" aria-label={`Paso ${step + 1} de 2`}>
          {[0, 1].map((index) => (
            <span
              key={index}
              className={cn(
                'h-1.5 rounded-full transition-all duration-500',
                index === step ? 'bg-primary w-7' : 'bg-muted-foreground/25 w-1.5',
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onFinish}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center px-2 text-sm transition-colors"
        >
          Omitir
        </button>
      </div>

      <div key={step} className="onboard-step relative flex flex-1 flex-col justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:px-10">
        {step === 0 && (
          <div className="mx-auto w-full max-w-md text-center">
            <div className="relative mx-auto mb-8 flex size-28 items-center justify-center">
              <span className="onboard-ring border-primary/25 border-t-primary absolute inset-0 rounded-full border-2" />
              <span className="bg-background border-primary/30 flex size-16 items-center justify-center rounded-2xl border shadow-xl shadow-black/20">
                <img
                  src="/icons/icon-192.webp"
                  alt=""
                  aria-hidden="true"
                  width={52}
                  height={52}
                  className="size-[52px] rounded-xl object-contain"
                />
              </span>
            </div>
            <h2 id="onboarding-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Tus libros, a pantalla completa
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm leading-relaxed sm:text-base">
              Lee sin conexión. Tu progreso se queda en este dispositivo, sin permisos especiales:
              solo abres los archivos que tú eliges. Después, pulsa Añadir para cargar tus libros.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="bg-primary text-primary-foreground mt-9 inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-medium shadow-lg shadow-black/10 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Empezar <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="mx-auto w-full max-w-lg">
            <h2 id="onboarding-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Gestos del lector
            </h2>

            <div className="mt-7 space-y-3">
              {FEATURES.map(({ Icon, title, detail, className }, index) => (
                <div
                  key={title}
                  className="border-border bg-card/80 flex items-center gap-4 rounded-2xl border p-4 shadow-sm backdrop-blur"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <span className="bg-primary/10 text-primary relative flex size-12 shrink-0 items-center justify-center rounded-xl">
                    <Icon className={cn('size-6', className)} aria-hidden="true" />
                    {index === 1 && (
                      <Sparkles
                        className="text-primary absolute -top-1 -right-1 size-3.5 onboard-gesture-pop"
                        aria-hidden="true"
                      />
                    )}
                    {index === 2 && (
                      <Volume2
                        className="text-primary absolute -right-1 -bottom-1 size-3.5 onboard-gesture-float"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed sm:text-sm">
                      {detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <div className="text-muted-foreground hidden items-center gap-1 text-xs sm:flex">
                <ChevronUp className="size-3.5" aria-hidden="true" />
                <ChevronDown className="size-3.5" aria-hidden="true" />
                Cambia de fragmento
              </div>
              <button
                type="button"
                onClick={onFinish}
                className="bg-primary text-primary-foreground ms-auto inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-medium shadow-lg shadow-black/10 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Entrar en Leeto <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
