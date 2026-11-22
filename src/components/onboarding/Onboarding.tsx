import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ListTree,
  Quote,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { greetingForName } from '@/lib/greeting';

interface OnboardingProps {
  onFinish: (name: string) => void;
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

/** Recorrido de primer uso: bienvenida, gestos y nombre para personalizar el saludo. */
export default function Onboarding({ onFinish }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 2) inputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFinish('');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onFinish]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    onFinish(name.trim());
  };

  return (
    <div
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

        <div className="flex gap-2" aria-label={`Paso ${step + 1} de 3`}>
          {[0, 1, 2].map((index) => (
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
          onClick={() => onFinish('')}
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          Omitir
        </button>
      </div>

      <div key={step} className="onboard-step relative flex flex-1 flex-col justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:px-10">
        {step === 0 && (
          <div className="mx-auto w-full max-w-md text-center">
            <div className="relative mx-auto mb-8 flex size-28 items-center justify-center">
              <span className="preloader-ring border-primary/25 border-t-primary absolute inset-0 rounded-full border-2" />
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
              Tu biblioteca, a tu ritmo
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm leading-relaxed sm:text-base">
              Leeto lee tus libros con texto a pantalla completa. Tus libros y tu progreso se
              quedan en este dispositivo.
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
              Así de fácil se lee
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Tres gestos y atajos para sentirte en casa.
            </p>

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
                onClick={() => setStep(2)}
                className="bg-primary text-primary-foreground ms-auto inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-medium shadow-lg shadow-black/10 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Continuar <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={submit} className="mx-auto w-full max-w-md text-center">
            <div className="bg-primary/10 text-primary mx-auto mb-7 flex size-16 items-center justify-center rounded-2xl">
              <Sparkles className="size-7" aria-hidden="true" />
            </div>
            <h2 id="onboarding-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              ¿Cómo te llamas?
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm">
              Te daremos la bienvenida cada vez que abras Leeto. Solo se guarda en este dispositivo.
            </p>

            <label className="mt-8 block text-left">
              <span className="text-muted-foreground mb-2 block text-xs font-medium tracking-wide uppercase">
                Tu nombre
              </span>
              <input
                ref={inputRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={24}
                autoComplete="given-name"
                placeholder="Por ejemplo, Juan"
                className="bg-card border-border h-12 w-full rounded-xl border px-4 text-base outline-none focus-visible:ring-2"
              />
            </label>

            <div className="bg-card border-border mt-4 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm">
              <span className="text-muted-foreground">Vista previa:</span>
              <span className="text-primary font-medium">{greetingForName(name)}</span>
            </div>

            <button
              type="submit"
              className="bg-primary text-primary-foreground mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-medium shadow-lg shadow-black/10 transition-transform hover:scale-[1.01] active:scale-[0.98]"
            >
              <Check className="size-4" aria-hidden="true" />
              Entrar en Leeto
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
