import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';

interface PreloaderProps {
  visible: boolean;
}

/** Portada de arranque: logo animado mientras se abre la base local. */
export default function Preloader({ visible }: PreloaderProps) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 500);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-label="Abriendo Leeto"
      aria-hidden={!visible}
      className={cn(
        'bg-background fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="relative flex size-32 items-center justify-center">
        <span className="preloader-ring border-primary/25 border-t-primary absolute inset-0 rounded-full border-2" />
        <span
          className="preloader-ring preloader-ring-reverse border-primary/10 border-b-primary/60 absolute inset-3 rounded-full border-2"
          style={{ animationDelay: '-0.6s' }}
        />
        <span className="bg-primary/10 absolute inset-7 rounded-full blur-xl" aria-hidden="true" />
        <span className="preloader-book bg-background border-primary/30 flex size-14 items-center justify-center rounded-2xl border shadow-lg shadow-black/20">
          <img
            src="/icons/icon-192.webp"
            alt=""
            aria-hidden="true"
            width={44}
            height={44}
            className="size-11 rounded-xl object-contain"
          />
        </span>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <span
            key={index}
            className="preloader-spark bg-primary absolute size-1 rounded-full"
            style={
              {
                '--spark-angle': `${index * 60}deg`,
                animationDelay: `${index * 0.18}s`,
              } as CSSProperties
            }
            aria-hidden="true"
          />
        ))}
      </div>

      <p className="preloader-title mt-8 text-3xl font-semibold tracking-[0.25em]">Leeto</p>
      <p className="preloader-subtitle text-muted-foreground mt-2 text-xs tracking-[0.2em] uppercase">
        Lee a tu ritmo
      </p>
      <div className="mt-8 flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="preloader-dot bg-primary size-1.5 rounded-full"
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
