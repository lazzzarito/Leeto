import { Library, ShieldCheck } from 'lucide-react';
import BookCard from '@/components/library/BookCard';
import Dropzone from '@/components/library/Dropzone';
import ImportQueue from '@/components/library/ImportQueue';
import { useImport } from '@/hooks/useImport';
import { useBooks } from '@/hooks/useLibrary';

export default function LibraryPage() {
  const books = useBooks();
  const { jobs, importFiles, clearFinished } = useImport();

  return (
    <div className="space-y-8">
      <section className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1>
        <p className="text-muted-foreground text-sm">
          Tus libros viven en este dispositivo. Sin cuenta, sin servidores, sin publicidad.
        </p>
      </section>

      <Dropzone onFiles={(files) => void importFiles(files)} />
      <ImportQueue jobs={jobs} onClear={clearFinished} />

      {books.length === 0 ? (
        <section
          aria-label="Biblioteca vacía"
          className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-14 text-center"
        >
          <div className="bg-muted mb-4 flex size-14 items-center justify-center rounded-full">
            <Library className="text-muted-foreground size-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-medium">Todavía no hay libros</h2>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Importa tu primer EPUB o PDF con texto seleccionable para empezar a leer.
          </p>
        </section>
      ) : (
        <section aria-label="Libros" className="space-y-3">
          <h2 className="text-sm font-medium">Mis libros ({books.length})</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </ul>
        </section>
      )}

      <section className="flex items-start gap-3 rounded-xl bg-muted/60 p-4">
        <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-medium">Privacidad por defecto</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            El progreso y las citas solo se guardan localmente, salvo que actives la
            sincronización con tu propia infraestructura.
          </p>
        </div>
      </section>
    </div>
  );
}
