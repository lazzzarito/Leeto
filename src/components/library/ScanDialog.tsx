import { FolderPlus, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import { DialogSkeleton } from '@/components/ui/Skeletons';
import {
  collectFromDirectory,
  ensureReadPermission,
  type BookCandidate,
} from '@/core/import/folder';
import type { ScanRoot } from '@/types';

interface ScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roots: ScanRoot[];
  canAddRoot: boolean;
  onAddRoot: () => void;
  onRemoveRoot: (id: string) => void;
  onScanned: (rootId: string, files: File[]) => void;
  onImport: (files: File[]) => void;
}

interface ScannedBook extends BookCandidate {
  key: string;
  selected: boolean;
}

export default function ScanDialog({
  open,
  onOpenChange,
  roots,
  canAddRoot,
  onAddRoot,
  onRemoveRoot,
  onScanned,
  onImport,
}: ScanDialogProps) {
  const [items, setItems] = useState<ScannedBook[]>([]);
  const [scanningRoot, setScanningRoot] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setError(undefined);
  }, [open]);

  const scan = async (root: ScanRoot) => {
    if (!root.handle) {
      setError('Esta raíz ya no tiene acceso directo. Vuelve a añadir la carpeta.');
      return;
    }
    setScanningRoot(root.id);
    setError(undefined);
    try {
      if (!(await ensureReadPermission(root.handle))) {
        setError('Permiso denegado. Habilita el acceso a la carpeta para escanearla.');
        return;
      }
      const candidates = await collectFromDirectory(root.handle);
      const files = await Promise.all(
        candidates.map(async (candidate) => ({
          key: `${root.id}/${candidate.path}`,
          path: `${root.name}/${candidate.path}`,
          file: await candidate.handle.getFile(),
          selected: true,
        })),
      );
      onScanned(
        root.id,
        files.map((item) => item.file),
      );
      setItems((previous) => {
        const merged = new Map(previous.map((item) => [item.key, item]));
        for (const item of files) merged.set(item.key, item);
        return [...merged.values()];
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo escanear la carpeta');
    } finally {
      setScanningRoot(undefined);
    }
  };

  const selected = items.filter((item) => item.selected);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Escanear carpetas"
      description="Encuentra libros en las carpetas que guardes."
      height="content"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">
            {selected.length} de {items.length} seleccionados
          </span>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => {
              onImport(selected.map((item) => item.file));
              onOpenChange(false);
            }}
            className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Importar seleccionados
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-8">
        <p className="text-muted-foreground text-xs">
          El navegador solo puede leer las carpetas que elijas. Si caduca el permiso, vuelve a
          elegirlas.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Carpetas guardadas</h3>
            {canAddRoot && (
              <button
                type="button"
                onClick={onAddRoot}
                className="text-primary inline-flex items-center gap-1.5 text-xs font-medium"
              >
                <FolderPlus className="size-3.5" aria-hidden="true" />
                Añadir carpeta
              </button>
            )}
          </div>

          {roots.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs">
              {canAddRoot
                ? 'No hay carpetas guardadas.'
                : 'Este dispositivo no permite guardar carpetas. En Android, por ahora selecciona varios libros a la vez.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {roots.map((root) => (
                <li
                  key={root.id}
                  className="border-border bg-card flex items-center gap-2 rounded-lg border p-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{root.name}</span>
                  <button
                    type="button"
                    onClick={() => void scan(root)}
                    disabled={scanningRoot === root.id}
                    aria-label={`Escanear ${root.name}`}
                    className="hover:bg-muted flex size-8 items-center justify-center rounded-md"
                  >
                    {scanningRoot === root.id ? (
                      <LoaderCircle className="text-muted-foreground size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="size-4" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveRoot(root.id)}
                    aria-label={`Quitar ${root.name}`}
                    className="text-muted-foreground hover:text-destructive flex size-8 items-center justify-center rounded-md"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {scanningRoot && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Buscando libros…</h3>
            <DialogSkeleton rows={2} />
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Libros encontrados</h3>
            <ul className="space-y-1">
              {items.map((item, index) => (
                <li key={item.key} className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5">
                  <input
                    id={`scan-item-${index}`}
                    type="checkbox"
                    checked={item.selected}
                    onChange={(event) =>
                      setItems((previous) =>
                        previous.map((entry) =>
                          entry.key === item.key ? { ...entry, selected: event.target.checked } : entry,
                        ),
                      )
                    }
                  />
                  <label htmlFor={`scan-item-${index}`} className="min-w-0 flex-1 truncate text-sm">
                    {item.path}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </div>
    </ResponsiveDialog>
  );
}
