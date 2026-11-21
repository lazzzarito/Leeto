import * as Dialog from '@radix-ui/react-dialog';
import { Library } from 'lucide-react';
import { useState } from 'react';
import Dropzone from '@/components/library/Dropzone';
import ImportQueue from '@/components/library/ImportQueue';
import LibraryTabs from '@/components/library/LibraryTabs';
import MetadataDialog from '@/components/library/MetadataDialog';
import SearchBar from '@/components/library/SearchBar';
import { deleteBookCascade } from '@/core/db/delete';
import { useImport } from '@/hooks/useImport';
import { useBooks, useQuotes } from '@/hooks/useLibrary';
import type { LeetoBook } from '@/types';

export default function LibraryPage() {
  const books = useBooks();
  const quotes = useQuotes();
  const { jobs, importFiles, clearFinished } = useImport();
  const [query, setQuery] = useState('');
  const [editingBookId, setEditingBookId] = useState<string>();
  const [deletingBook, setDeletingBook] = useState<LeetoBook>();
  const [error, setError] = useState<string>();

  const editingBook = books.find((book) => book.id === editingBookId);

  const handleDelete = async () => {
    if (!deletingBook) return;
    try {
      await deleteBookCascade(deletingBook.id);
      setDeletingBook(undefined);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el libro');
    }
  };

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
        <section aria-label="Libros" className="space-y-4">
          <SearchBar value={query} onChange={setQuery} />
          <LibraryTabs
            books={books}
            quotes={quotes}
            query={query}
            onEdit={(book) => setEditingBookId(book.id)}
            onDelete={setDeletingBook}
          />
        </section>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <MetadataDialog
        book={editingBook}
        open={Boolean(editingBook)}
        onOpenChange={(open) => {
          if (!open) setEditingBookId(undefined);
        }}
      />

      <Dialog.Root open={Boolean(deletingBook)} onOpenChange={(open) => !open && setDeletingBook(undefined)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
          <Dialog.Content className="bg-card text-card-foreground fixed top-1/2 left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border p-5 shadow-xl">
            <Dialog.Title className="text-lg font-semibold">Eliminar libro</Dialog.Title>
            <Dialog.Description className="text-muted-foreground mt-2 text-sm">
              Se borrarán también su progreso, citas e imágenes. Esta acción no se puede deshacer.
            </Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="border-border hover:bg-muted rounded-lg border px-3 py-1.5 text-sm"
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="bg-destructive text-destructive-foreground rounded-lg px-3 py-1.5 text-sm font-medium"
              >
                Eliminar
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
