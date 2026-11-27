import { CheckCircle2, Clock3, FolderOpen, Loader2 } from 'lucide-react';
import { formatFileSize } from '@/lib/file';
import { useSettings } from '@/core/db/settings';
import { isSyncConfigured } from '@/hooks/useSync';
import { useSyncController } from '@/hooks/useSyncContext';

/** Resumen de carpetas importadas y de su disponibilidad en otros dispositivos. */
export default function ImportedFoldersSettings() {
  const settings = useSettings();
  const { status } = useSyncController();
  const roots = settings.scanRoots ?? [];
  const syncReady = settings.syncEnabled && isSyncConfigured(settings);

  const state = (syncedAt?: number) => {
    if (status.phase === 'syncing') {
      return { label: 'Sincronizando…', icon: Loader2, tone: 'text-muted-foreground' };
    }
    if (syncedAt && syncReady) {
      return { label: 'Sincronizada', icon: CheckCircle2, tone: 'text-primary' };
    }
    if (syncReady) {
      return { label: 'Pendiente', icon: Clock3, tone: 'text-muted-foreground' };
    }
    return { label: 'Solo en este dispositivo', icon: Clock3, tone: 'text-muted-foreground' };
  };

  return (
    <section
      aria-labelledby="folders-heading"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div>
        <h2 id="folders-heading" className="text-base font-medium">
          Carpetas importadas
        </h2>
        <p className="text-muted-foreground text-sm">
          Contenido, tamaño y estado de sincronización de las carpetas de tu dispositivo.
        </p>
      </div>

      {roots.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs">
          Todavía no has importado ninguna carpeta.
        </p>
      ) : (
        <ul className="space-y-2">
          {roots.map((root) => {
            const { label, icon: Icon, tone } = state(root.syncedAt);
            return (
              <li
                key={root.id}
                className="border-border flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <FolderOpen className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{root.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {root.bookCount ?? 0} libros · {formatFileSize(root.totalSize ?? 0)}
                  </p>
                </div>
                <span className={`${tone} inline-flex shrink-0 items-center gap-1 text-xs`}>
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
