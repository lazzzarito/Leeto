import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
}

/** Bloque base con brillo animado; imita la forma del contenido real. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('skeleton-shimmer rounded-md', className)} />;
}

export function BookCardSkeleton() {
  return (
    <li className="space-y-2">
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-2.5 w-2/5" />
      <Skeleton className="mt-2 h-1 w-full rounded-full" />
    </li>
  );
}

/** Placeholder de la biblioteca con pestañas, tarjetas y barra flotante. */
export function LibrarySkeleton() {
  return (
    <div role="status" aria-label="Cargando biblioteca" className="space-y-4">
      <div className="bg-background/85 sticky top-[env(safe-area-inset-top,0px)] z-20 flex gap-3 px-1 pt-3 pb-2.5 backdrop-blur">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-6 w-16 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 8 }, (_, index) => (
          <BookCardSkeleton key={index} />
        ))}
      </div>
      <span className="sr-only">Cargando biblioteca…</span>
    </div>
  );
}

/** Placeholder a pantalla completa con la silueta del reproductor. */
export function ReaderSkeleton() {
  return (
    <main
      role="status"
      aria-label="Cargando lector"
      className="bg-reader text-reader flex h-dvh w-full flex-col items-center justify-between overflow-hidden"
    >
      <div className="w-full space-y-3 px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <Skeleton className="h-1 w-full rounded-full opacity-40" />
        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full opacity-40" />
          <Skeleton className="h-4 w-2/5 opacity-40" />
          <Skeleton className="ms-auto size-8 shrink-0 rounded-full opacity-40" />
        </div>
      </div>

      <div className="flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-6">
        <Skeleton className="mx-auto h-5 w-3/5 opacity-30" />
        <Skeleton className="h-4 w-full opacity-30" />
        <Skeleton className="h-4 w-11/12 opacity-30" />
        <Skeleton className="h-4 w-4/5 opacity-30" />
      </div>

      <div className="mb-[calc(env(safe-area-inset-bottom)+1.5rem)] flex w-full max-w-md items-center justify-around px-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <Skeleton className="size-7 rounded-full opacity-40" />
            <Skeleton className="h-2 w-8 opacity-40" />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando lector…</span>
    </main>
  );
}

/** Placeholder para diálogos y menús con contenido pendiente. */
export function DialogSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando contenido" className="space-y-4 pb-6">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-2.5 w-2/5" />
          </div>
        </div>
      ))}
      <span className="sr-only">Cargando contenido…</span>
    </div>
  );
}
