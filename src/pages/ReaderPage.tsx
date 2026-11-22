import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import LeetoPlayer from '@/components/player/LeetoPlayer';
import { ReaderSkeleton } from '@/components/ui/Skeletons';
import { db } from '@/core/db/db';

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const book = useLiveQuery(() => (id ? db.books.get(id) : undefined), [id], null);

  if (book === null) return <ReaderSkeleton />;

  if (!book) {
    return (
      <main className="bg-reader text-reader flex h-[100dvh] w-full items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
        <img
          src="/icons/icon-192.webp"
          alt=""
          aria-hidden="true"
          width={32}
          height={32}
          className="mx-auto size-8 rounded-lg object-contain opacity-60"
        />
        <h1 className="mt-3 text-lg font-medium">Libro no encontrado</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Puede que se haya eliminado de este dispositivo.
        </p>
        <Link
          to="/"
          className="border-border hover:bg-muted mt-5 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a la biblioteca
        </Link>
        </div>
      </main>
    );
  }

  return <LeetoPlayer book={book} />;
}
