import { useLiveQuery } from 'dexie-react-hooks';
import { Library, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import AddMenu from '@/components/library/AddMenu';
import Dropzone from '@/components/library/Dropzone';
import ImportQueue from '@/components/library/ImportQueue';
import ImportToasts from '@/components/library/ImportToasts';
import LibraryTabs from '@/components/library/LibraryTabs';
import MetadataDialog from '@/components/library/MetadataDialog';
import ScanDialog from '@/components/library/ScanDialog';
import SearchBar from '@/components/library/SearchBar';
import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import { LibrarySkeleton } from '@/components/ui/Skeletons';
import { deleteBookCascade } from '@/core/db/delete';
import { addScanRoot, getSettings, removeScanRoot, useSettings } from '@/core/db/settings';
import {
  fromFileList,
  isDirectoryPickerSupported,
  pickBookDirectory,
} from '@/core/import/folder';
import { useImport } from '@/hooks/useImport';
import { useBooks, useBooksLoading, useQuotes } from '@/hooks/useLibrary';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { newId } from '@/lib/ids';
import type { LeetoBook } from '@/types';

const TABS = ['all', 'authors', 'sagas', 'quotes'] as const;

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

export default function LibraryPage() {
  const books = useBooks();
  const booksLoading = useBooksLoading();
  const quotes = useQuotes();
  const settings = useSettings();
  const savedSettings = useLiveQuery(() => getSettings(), [], settings);
  const roots = savedSettings.scanRoots ?? [];
  const { jobs, toasts, importFiles, dismissToast } = useImport();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const requestedTab = searchParams.get('tab') ?? 'all';
  const tab = (TABS as readonly string[]).includes(requestedTab) ? requestedTab : 'all';

  const [editingBookId, setEditingBookId] = useState<string>();
  const [deletingBook, setDeletingBook] = useState<LeetoBook>();
  const [scanOpen, setScanOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const dragDepth = useRef(0);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  useEffect(() => {
    setActionSlot(
      document.getElementById(isDesktop ? 'library-sidebar-actions' : 'library-floating-actions'),
    );
  }, [isDesktop]);

  const editingBook = books.find((book) => book.id === editingBookId);

  const setParam = (key: 'q' | 'tab', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && !(key === 'tab' && value === 'all')) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

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

  const handlePickFolder = async () => {
    try {
      const handle = await pickBookDirectory();
      if (!handle) return;
      await addScanRoot({
        id: newId('root'),
        name: handle.name,
        addedAt: Date.now(),
        handle,
      });
      setScanOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo añadir la carpeta');
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = fromFileList(Array.from(event.dataTransfer.files));
    if (files.length > 0) void importFiles(files.map((file) => file.file));
  };

  return (
    <div
      className="relative isolate pb-28"
      onDragEnter={handleDragEnter}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h1 className="sr-only">Biblioteca</h1>

      <ImportQueue jobs={jobs} />

      {booksLoading ? (
        <LibrarySkeleton />
      ) : books.length === 0 ? (
        <section aria-label="Biblioteca vacía" className="space-y-4">
          <div className="text-center">
            <div className="bg-muted mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
              <Library className="text-muted-foreground size-5" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-medium">Todavía no hay libros</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Importa tu primer EPUB o PDF con texto seleccionable.
            </p>
          </div>
          <Dropzone onFiles={(files) => void importFiles(files)} />
        </section>
      ) : (
        <LibraryTabs
          books={books}
          quotes={quotes}
          query={query}
          value={tab}
          onValueChange={(value) => setParam('tab', value)}
          onEdit={(book) => setEditingBookId(book.id)}
          onDelete={setDeletingBook}
        />
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
        >
          <div className="border-primary bg-background flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-10 py-8 text-center shadow-2xl">
            <UploadCloud className="text-primary size-8" />
            <p className="text-lg font-medium">Suelta para importar</p>
            <p className="text-muted-foreground text-sm">EPUB y PDF con texto seleccionable</p>
          </div>
        </div>
      )}

      <MetadataDialog
        book={editingBook}
        open={Boolean(editingBook)}
        onOpenChange={(open) => {
          if (!open) setEditingBookId(undefined);
        }}
      />

      <ScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        roots={roots}
        canAddRoot={isDirectoryPickerSupported()}
        onAddRoot={() => void handlePickFolder()}
        onRemoveRoot={(id) => void removeScanRoot(id)}
        onImport={(files) => void importFiles(files)}
      />

      <ResponsiveDialog
        open={Boolean(deletingBook)}
        onOpenChange={(open) => !open && setDeletingBook(undefined)}
        height="content"
        title="Eliminar libro"
        description="Se borrarán también su progreso, citas e imágenes."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingBook(undefined)}
              className="border-border hover:bg-muted rounded-lg border px-3 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground rounded-lg px-3 py-2 text-sm font-medium"
            >
              Eliminar
            </button>
          </div>
        }
      >
        <p className="text-muted-foreground pb-6 text-sm">Esta acción no se puede deshacer.</p>
      </ResponsiveDialog>

      <ImportToasts toasts={toasts} onDismiss={dismissToast} />

      {actionSlot &&
        createPortal(
          <AddMenu
            onFiles={(files) => void importFiles(files)}
            onPickFolder={() => void handlePickFolder()}
            onOpenScan={() => setScanOpen(true)}
            nativeFolderPicker={isDirectoryPickerSupported()}
            fullWidth={isDesktop}
          />,
          actionSlot,
        )}

      <div className="pb-safe pointer-events-none fixed inset-x-4 bottom-4 z-30 flex justify-center sm:inset-x-6 md:bottom-6 lg:left-[calc(16rem+1.5rem)] lg:right-6">
        <div className="pointer-events-auto flex w-full items-center gap-2">
          <SearchBar value={query} onChange={(value) => setParam('q', value)} />
          <div id="library-floating-actions" className="shrink-0" />
        </div>
      </div>
    </div>
  );
}
