import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, BookOpenText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import LeetoPlayer from '@/components/player/LeetoPlayer';
import { db } from '@/core/db/db';

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const book = useLiveQuery(() => (id ? db.books.get(id) : undefined), [id], null);

  if (book === null) {
    return <p className="text-muted-foreground text-sm">Cargando libro…</p>;
  }

  if (!book) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
        <BookOpenText className="text-muted-foreground mx-auto size-7" aria-hidden="true" />
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
    );
  }

  return <LeetoPlayer book={book} />;
}
