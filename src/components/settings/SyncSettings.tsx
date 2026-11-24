import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Download,
  FolderOpen,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { updateSettings } from '@/core/db/settings';
import { clearWebDavPassword, getWebDavPassword, saveWebDavPassword } from '@/core/sync/credentials';
import { getSyncDirectory, isLocalFolderSupported, pickSyncDirectory } from '@/core/sync/localFolder';
import { readFileTextLimited } from '@/core/sync/limits';
import { isSecureSyncUrl } from '@/core/sync/provider';
import { useSettings } from '@/core/db/settings';
import { isSyncConfigured } from '@/hooks/useSync';
import { useSyncController } from '@/hooks/useSyncContext';

type ConfirmAction = 'import' | 'restore';

const INPUT_CLASS =
  'bg-background border-border h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2';
const BUTTON_CLASS =
  'border-border hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60';

export default function SyncSettings() {
  const settings = useSettings();
  const { status, syncNow, exportJson, importJson, restoreBackupNow } = useSyncController();
  const [password, setPassword] = useState(getWebDavPassword);
  const [folderName, setFolderName] = useState(getSyncDirectory()?.name);
  const [pendingText, setPendingText] = useState<string>();
  const [importError, setImportError] = useState<string>();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const folderSupported = isLocalFolderSupported();
  const insecureUrl = Boolean(settings.syncWebDavUrl) && !isSecureSyncUrl(settings.syncWebDavUrl!);
  const syncing = status.phase === 'syncing' || busy;
  const configured = isSyncConfigured(settings);

  const chooseFolder = async () => {
    try {
      const directory = await pickSyncDirectory();
      setFolderName(directory?.name);
    } catch {
      setFolderName(undefined);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setPendingText(await readFileTextLimited(file));
      setImportError(undefined);
      setConfirmAction('import');
    } catch (error) {
      setPendingText(undefined);
      setImportError(error instanceof Error ? error.message : 'No se pudo leer el archivo');
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setBusy(true);
    try {
      if (confirmAction === 'import' && pendingText) await importJson(pendingText);
      if (confirmAction === 'restore') await restoreBackupNow();
      setConfirmAction(undefined);
      setPendingText(undefined);
    } catch {
      // El hook ya expone el error en `status`.
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    try {
      await syncNow();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="sync-heading"
      className="space-y-5 rounded-xl border border-border bg-card p-4"
    >
      <div>
        <h2 id="sync-heading" className="text-base font-medium">
          Sincronización
        </h2>
        <p className="text-muted-foreground text-sm">
          Progreso, citas y referencias en un archivo JSON. Se fusiona registro a registro y se guarda
          un backup antes de escribir.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.syncEnabled}
          onChange={(event) => void updateSettings({ syncEnabled: event.target.checked })}
        />
        Activar sincronización automática
      </label>

      <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-muted-foreground mb-1 block text-xs font-medium">Proveedor</span>
          <select
            value={settings.syncProvider ?? 'webdav'}
            onChange={(event) =>
              void updateSettings({
                syncProvider: event.target.value as 'webdav' | 'local-folder',
              })
            }
            className={INPUT_CLASS}
          >
            <option value="webdav">WebDAV (Nextcloud, servidor propio)</option>
            <option value="local-folder" disabled={!folderSupported}>
              Carpeta local {folderSupported ? '' : '(no disponible)'}
            </option>
          </select>
        </label>

        {(settings.syncProvider ?? 'webdav') === 'webdav' ? (
          <>
            <label className="block">
              <span className="text-muted-foreground mb-1 block text-xs font-medium">
                URL de la carpeta LeetoSync/
              </span>
              <input
                type="url"
                value={settings.syncWebDavUrl ?? ''}
                placeholder="https://dav.ejemplo.com/remote.php/dav/files/usuario/LeetoSync"
                onChange={(event) => void updateSettings({ syncWebDavUrl: event.target.value })}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground mb-1 block text-xs font-medium">Usuario</span>
              <input
                value={settings.syncWebDavUsername ?? ''}
                autoComplete="username"
                onChange={(event) =>
                  void updateSettings({ syncWebDavUsername: event.target.value })
                }
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground mb-1 block text-xs font-medium">
                Contraseña (solo esta sesión)
              </span>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  saveWebDavPassword(event.target.value);
                }}
                className={INPUT_CLASS}
              />
            </label>
            {insecureUrl && (
              <p className="text-destructive flex items-start gap-2 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                WebDAV con credenciales requiere HTTPS. Solo se permite HTTP en localhost.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <span className="text-muted-foreground block text-xs font-medium">Carpeta local</span>
            {folderSupported ? (
              <>
                <button type="button" onClick={() => void chooseFolder()} className={BUTTON_CLASS}>
                  <FolderOpen className="size-4" aria-hidden="true" />
                  {folderName ?? 'Elegir carpeta…'}
                </button>
                <p className="text-muted-foreground text-xs">
                  Se guardarán <code>leeto_sync.json</code> y su backup en esa carpeta. Deberás
                  volver a elegirla al recargar la página.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-xs">
                Este navegador no ofrece File System Access API. Usa WebDAV o exporta/importa el
                JSON manualmente.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing || !configured}
            className="bg-primary text-primary-foreground inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Sincronizar ahora
          </button>
          <button type="button" onClick={() => void exportJson()} className={`${BUTTON_CLASS} w-full justify-center`}>
            <Download className="size-4" aria-hidden="true" />
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`${BUTTON_CLASS} w-full justify-center`}
          >
            <Upload className="size-4" aria-hidden="true" />
            Importar JSON
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => void handleFile(event)} />
          <button
            type="button"
            onClick={() => setConfirmAction('restore')}
            className={`${BUTTON_CLASS} w-full justify-center`}
          >
            <ArchiveRestore className="size-4" aria-hidden="true" />
            Restaurar backup
          </button>
        </div>
        {password && (
          <button
            type="button"
            onClick={() => {
              clearWebDavPassword();
              setPassword('');
            }}
            className="text-muted-foreground mt-2 w-full text-xs underline"
          >
            Olvidar contraseña
          </button>
        )}
      </div>

      {importError && (
        <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {importError}
        </p>
      )}

      {status.message && (
        <p
          role="status"
          className={
            status.phase === 'error'
              ? 'text-destructive flex items-center gap-2 text-sm'
              : 'text-muted-foreground flex items-center gap-2 text-sm'
          }
        >
          {status.phase === 'error' ? (
            <AlertTriangle className="size-4" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          )}
          {status.message}
          {status.lastSyncedAt
            ? ` · ${new Date(status.lastSyncedAt).toLocaleString()}`
            : ''}
        </p>
      )}

      <Dialog.Root open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(undefined)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-[leeto-fade-in_180ms_ease-out] data-[state=closed]:animate-[leeto-fade-out_140ms_ease-in]" />
          <Dialog.Content className="bg-card text-card-foreground fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border p-5 shadow-xl data-[state=open]:animate-[leeto-scale-in_200ms_ease-out] data-[state=closed]:animate-[leeto-scale-out_150ms_ease-in]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-lg font-medium">
                  {confirmAction === 'restore' ? 'Restaurar backup' : 'Importar sincronización'}
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground mt-1 text-sm">
                  {confirmAction === 'restore'
                    ? 'Se fusionará el último backup con el estado actual. No se pierde progreso más reciente.'
                    : 'El JSON se fusionará registro a registro con el estado local.'}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" aria-label="Cerrar" className="text-muted-foreground rounded-md p-1">
                  <X className="size-4" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className={BUTTON_CLASS}>Cancelar</button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={syncing}
                className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm disabled:opacity-60"
              >
                Continuar
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
