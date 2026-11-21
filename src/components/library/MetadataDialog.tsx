import * as Dialog from '@radix-ui/react-dialog';
import { ImagePlus, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { updateBookMetadata } from '@/core/db/delete';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import type { LeetoBook } from '@/types';

interface MetadataDialogProps {
  book?: LeetoBook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INPUT_CLASS =
  'bg-background border-border h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2';
const LABEL_CLASS = 'text-muted-foreground mb-1 block text-xs font-medium';

export default function MetadataDialog({ book, open, onOpenChange }: MetadataDialogProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [saga, setSaga] = useState('');
  const [volume, setVolume] = useState('');
  const [coverFile, setCoverFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const currentCoverUrl = useAssetUrl(book?.coverAssetId);

  useEffect(() => {
    if (!book || !open) return;
    setTitle(book.title);
    setAuthor(book.author);
    setSaga(book.saga ?? '');
    setVolume(book.volumeNumber?.toString() ?? '');
    setCoverFile(undefined);
    setError(undefined);
  }, [book, open]);

  useEffect(() => {
    if (!coverFile) {
      setPreviewUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!book) return;

    const parsedVolume = volume.trim() ? Number(volume) : undefined;
    setSaving(true);
    setError(undefined);
    try {
      await updateBookMetadata(book.id, {
        title,
        author,
        saga,
        ...(parsedVolume !== undefined && Number.isFinite(parsedVolume)
          ? { volumeNumber: parsedVolume }
          : {}),
        ...(coverFile
          ? { cover: { blob: coverFile, mimeType: coverFile.type || 'image/jpeg' } }
          : {}),
      });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="bg-card text-card-foreground fixed top-1/2 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Editar libro</Dialog.Title>
              <Dialog.Description className="text-muted-foreground mt-1 text-sm">
                Los cambios se guardan solo en este dispositivo.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground rounded-md p-1"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-3">
            <div>
              <label htmlFor="edit-title" className={LABEL_CLASS}>
                Título
              </label>
              <input
                id="edit-title"
                className={INPUT_CLASS}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="edit-author" className={LABEL_CLASS}>
                Autor
              </label>
              <input
                id="edit-author"
                className={INPUT_CLASS}
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-saga" className={LABEL_CLASS}>
                  Saga
                </label>
                <input
                  id="edit-saga"
                  className={INPUT_CLASS}
                  value={saga}
                  onChange={(event) => setSaga(event.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label htmlFor="edit-volume" className={LABEL_CLASS}>
                  Volumen
                </label>
                <input
                  id="edit-volume"
                  type="number"
                  step="0.5"
                  className={INPUT_CLASS}
                  value={volume}
                  onChange={(event) => setVolume(event.target.value)}
                  placeholder="—"
                />
              </div>
            </div>

            <div>
              <span className={LABEL_CLASS}>Portada</span>
              <div className="flex items-center gap-3">
                <div className="bg-muted flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  {previewUrl || currentCoverUrl ? (
                    <img
                      src={previewUrl ?? currentCoverUrl}
                      alt="Vista previa de la portada"
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="text-muted-foreground size-5" aria-hidden="true" />
                  )}
                </div>
                <label className="border-border hover:bg-muted cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium">
                  Cambiar imagen
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label="Seleccionar nueva portada"
                    onChange={(event) => setCoverFile(event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-destructive text-xs">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="border-border hover:bg-muted rounded-lg border px-3 py-1.5 text-sm"
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
