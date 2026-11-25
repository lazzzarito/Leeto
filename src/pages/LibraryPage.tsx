import { useLiveQuery } from 'dexie-react-hooks';
import { UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/cn';
import AddMenu from '@/components/library/AddMenu';
import Dropzone from '@/components/library/Dropzone';
import LibraryTabs from '@/components/library/LibraryTabs';
import MetadataDialog from '@/components/library/MetadataDialog';
import ScanDialog from '@/components/library/ScanDialog';
import SearchBar from '@/components/library/SearchBar';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import { LibrarySkeleton } from '@/components/ui/Skeletons';
import { deleteBookCascade, restoreBookSnapshot } from '@/core/db/delete';
import { getReadingStatus } from '@/core/library/views';

import { addScanRoot, getSettings, removeScanRoot, useSettings } from '@/core/db/settings';
import {
  fromFileList,
  isDirectoryPickerSupported,
  pickBookDirectory,
} from '@/core/import/folder';
import { BOOK_FORMAT_LABEL } from '@/core/parsers/formats';
import { useBooks, useBooksLoading, useProgressByBook, useQuotes } from '@/hooks/useLibrary';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { newId } from '@/lib/ids';
import type { LeetoBook } from '@/types';

const TABS = ['reading', 'finished', 'favorites', 'all', 'authors', 'sagas', 'quotes'] as const;

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

export default function LibraryPage() {
  const books = useBooks();
  const booksLoading = useBooksLoading();
  const quotes = useQuotes();
  const progressByBook = useProgressByBook();
  const settings = useSettings();
  const savedSettings = useLiveQuery(() => getSettings(), [], settings);
  const roots = savedSettings.scanRoots ?? [];
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const requestedTab = searchParams.get('tab');
  const tab = requestedTab && (TABS as readonly string[]).includes(requestedTab) ? requestedTab : 'all';

  const [editingBookId, setEditingBookId] = useState<string>();
  const [deletingBook, setDeletingBook] = useState<LeetoBook>();
  const [scanOpen, setScanOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const [searchSlot, setSearchSlot] = useState<HTMLElement | null>(null);
  const dragDepth = useRef(0);
  const initialTabDone = useRef(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { push } = useNotifications();
  const { chromeHidden, importFiles, refreshing } = useOutletContext<{
    chromeHidden: boolean;
    importFiles: (files: File[]) => Promise<void>;
    refreshing?: boolean;
  }>() ?? { chromeHidden: false, importFiles: async () => undefined, refreshing: false };

  useEffect(() => {
    setActionSlot(
      document.getElementById(isDesktop ? 'library-sidebar-actions' : 'library-floating-actions'),
    );
    setSearchSlot(isDesktop ? document.getElementById('library-sidebar-search') : null);
  }, [isDesktop]);

  useEffect(() => {
    if (initialTabDone.current) return;
    const requested = searchParams.get('tab');
    if (requested) { initialTabDone.current = true; return; }
    if (booksLoading) return;
    initialTabDone.current = true;
    const hasReading = Array.from(progressByBook.values()).some(
      (item) => getReadingStatus(item) === 'reading',
    );
    const next = new URLSearchParams(searchParams);
    next.set('tab', hasReading ? 'reading' : 'all');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booksLoading, progressByBook, searchParams]);

  const editingBook = books.find((book) => book.id === editingBookId);

  const setParam = (key: 'q' | 'tab', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const handleDelete = async () => {
    if (!deletingBook) return;
    try {
      const snapshot = await deleteBookCascade(deletingBook.id);
      const title = deletingBook.title;
      setDeletingBook(undefined);
      setError(undefined);
      push({
        kind: 'info',
        title: 'Libro eliminado',
        subtitle: title,
        durationMs: 6000,
        actions: snapshot
          ? [
              {
                label: 'Deshacer',
                variant: 'secondary',
                onClick: () => {
                  void restoreBookSnapshot(snapshot).catch((cause) => {
                    setError(cause instanceof Error ? cause.message : 'No se pudo restaurar el libro');
                  });
                },
              },
            ]
          : undefined,
      });
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
      className="relative isolate pb-8 lg:pb-4"
      onDragEnter={handleDragEnter}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h1 className="sr-only">Biblioteca</h1>

      {booksLoading || refreshing ? (
        <LibrarySkeleton />
      ) : books.length === 0 ? (
        <section aria-label="Biblioteca vacía">
          <Dropzone onFiles={(files) => void importFiles(files)} />
        </section>
      ) : (
        <LibraryTabs
          books={books}
          quotes={quotes}
          progressByBook={progressByBook}
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
            <p className="text-muted-foreground text-sm">{BOOK_FORMAT_LABEL}</p>
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
        variant="centered"
        title="Eliminar libro"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground flex-1 rounded-lg px-3 py-2 text-sm font-medium"
            >
              Eliminar
            </button>
            <button
              type="button"
              onClick={() => setDeletingBook(undefined)}
              className="border-border hover:bg-muted flex-1 rounded-lg border px-3 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        }
      >
        <div className="text-muted-foreground space-y-1 pb-6 text-sm">
          <p>Se borrarán también su progreso, citas e imágenes.</p>
          <p>Podrás deshacerla desde la notificación durante unos segundos.</p>
        </div>
      </ResponsiveDialog>

      {searchSlot &&
        createPortal(
          <div className="w-full">
            <SearchBar value={query} onChange={(value) => setParam('q', value)} />
          </div>,
          searchSlot,
        )}

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

      <div
        className={cn(
          'pb-safe pointer-events-none fixed inset-x-4 bottom-4 z-30 justify-center transition-transform duration-300 sm:inset-x-6 md:bottom-6 lg:left-[calc(16rem+1.5rem)] lg:right-6',
          isDesktop ? 'hidden' : 'flex',
          chromeHidden && 'translate-y-[calc(100%+2rem)]',
        )}
      >
        <div className="pointer-events-auto flex w-full items-center justify-center gap-2">
          {!isDesktop && (
            <SearchBar
              value={query}
              onChange={(value) => setParam('q', value)}
              className={cn(
                'transition-[width] duration-200',
                query ? 'w-full flex-1' : 'w-[6.5rem] flex-none',
              )}
            />
          )}
          <div id="library-floating-actions" className={cn('shrink-0', !isDesktop && query && 'hidden')} />
        </div>
      </div>
    </div>
  );
}
