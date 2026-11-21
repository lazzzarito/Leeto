import { ArrowLeft, BookOpenText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="bg-reader text-reader flex min-h-[70dvh] flex-col items-center justify-center rounded-xl border border-border px-6 text-center">
      <BookOpenText className="text-primary size-8" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-medium">Lector</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Aquí se reproducirán los bloques del libro <code className="break-all">{id}</code> como un
        feed vertical. El motor y la cinética llegan en la fase 4.
      </p>
      <Link
        to="/"
        className="border-border hover:bg-muted mt-6 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a la biblioteca
      </Link>
    </div>
  );
}
