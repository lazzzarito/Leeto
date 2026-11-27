import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FolderOpen, FolderSearch, Plus, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import ResponsiveDialog from '@/components/ui/ResponsiveDialog';
import { fromFileList, isDirectoryInputSupported } from '@/core/import/folder';
import { BOOK_ACCEPT } from '@/core/parsers/formats';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

interface AddMenuProps {
  onFiles: (files: File[]) => void;
  onPickFolder: () => void;
  onOpenScan: () => void;
  nativeFolderPicker: boolean;
  /** WebView Android no soporta elegir carpetas; mostramos un camino alternativo claro. */
  folderImportUnsupported?: boolean;
  fullWidth?: boolean;
}

const ITEM_CLASS =
  'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-sm outline-none hover:bg-accent data-[highlighted]:bg-accent';

export default function AddMenu({
  onFiles,
  onPickFolder,
  onOpenScan,
  nativeFolderPicker,
  folderImportUnsupported = false,
  fullWidth = false,
}: AddMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const canUseDirectoryInput = isDirectoryInputSupported();
  const canUseFolder = !folderImportUnsupported && (nativeFolderPicker || canUseDirectoryInput);

  const pickFolder = () => {
    if (nativeFolderPicker) onPickFolder();
    else if (canUseDirectoryInput) folderInputRef.current?.click();
    else fileInputRef.current?.click();
  };

  const folderActionLabel = canUseFolder ? 'Carpeta completa' : 'Varios libros a la vez';

  const actions = (
    <>
      <button type="button" className={ITEM_CLASS} onClick={() => { setOpen(false); fileInputRef.current?.click(); }}>
        <Upload className="size-4" aria-hidden="true" />
        Archivos de libro
      </button>
      {folderImportUnsupported ? (
        <div className="text-muted-foreground rounded-lg px-3 py-3 text-sm">
          <div className="text-foreground flex items-center gap-3 font-medium">
            <FolderOpen className="size-4" aria-hidden="true" />
            Carpeta completa
          </div>
          <p className="mt-1 pl-7 text-xs leading-relaxed">
            En Android, por ahora selecciona varios libros a la vez.
          </p>
        </div>
      ) : (
        <button type="button" className={ITEM_CLASS} onClick={() => { setOpen(false); pickFolder(); }}>
          <FolderOpen className="size-4" aria-hidden="true" />
          {folderActionLabel}
        </button>
      )}
      {!folderImportUnsupported && (
        <button type="button" className={ITEM_CLASS} onClick={() => { setOpen(false); onOpenScan(); }}>
          <FolderSearch className="size-4" aria-hidden="true" />
          Escanear carpetas guardadas
        </button>
      )}
    </>
  );

  return (
    <>
      {isDesktop ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={cn(
                'border-border hover:bg-muted inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium',
                fullWidth ? 'flex w-full justify-start px-2' : 'bg-card text-foreground shadow-lg',
              )}
            >
              <Plus className="size-4" aria-hidden="true" />
              Añadir
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="bg-popover text-popover-foreground z-[70] min-w-56 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-lg border border-border p-1.5 shadow-xl data-[state=open]:animate-[leeto-pop-in_160ms_ease-out] data-[state=closed]:animate-[leeto-pop-out_120ms_ease-in]"
            >
              <DropdownMenu.Item className={ITEM_CLASS} onSelect={() => fileInputRef.current?.click()}>
                <Upload className="size-4" aria-hidden="true" />
                Archivos de libro
              </DropdownMenu.Item>
              {folderImportUnsupported ? (
                <DropdownMenu.Item
                  disabled
                  className="text-muted-foreground flex cursor-default flex-col items-start gap-0.5 rounded-lg px-3 py-3 text-left text-sm outline-none data-[disabled]:opacity-100"
                >
                  <span className="text-foreground/70 flex items-center gap-3 font-medium">
                    <FolderOpen className="size-4" aria-hidden="true" />
                    Carpeta completa
                  </span>
                  <span className="pl-7 text-xs">En Android, por ahora selecciona varios libros a la vez.</span>
                </DropdownMenu.Item>
              ) : (
                <>
                  <DropdownMenu.Item className={ITEM_CLASS} onSelect={pickFolder}>
                    <FolderOpen className="size-4" aria-hidden="true" />
                    {folderActionLabel}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className={ITEM_CLASS} onSelect={onOpenScan}>
                    <FolderSearch className="size-4" aria-hidden="true" />
                    Escanear carpetas guardadas
                  </DropdownMenu.Item>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border-border bg-card text-foreground hover:bg-muted inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium shadow-lg"
          >
            <Plus className="size-4" aria-hidden="true" />
            Añadir
          </button>
          <ResponsiveDialog
            open={open}
            onOpenChange={setOpen}
            height="content"
            variant="centered"
            title="Añadir"
            description="Importa libros desde archivos o carpetas."
          >
            <div className="space-y-1 pb-6">{actions}</div>
          </ResponsiveDialog>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={BOOK_ACCEPT}
        multiple
        hidden
        className="sr-only"
        aria-label="Seleccionar archivos de libro"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = '';
        }}
      />
      <input
        ref={(element) => {
          folderInputRef.current = element;
          element?.setAttribute('webkitdirectory', '');
          element?.setAttribute('directory', '');
        }}
        type="file"
        multiple
        hidden
        className="sr-only"
        aria-label="Seleccionar una carpeta de libros"
        onChange={(event) => {
          const files = fromFileList(Array.from(event.target.files ?? []));
          if (files.length > 0) onFiles(files.map((file) => file.file));
          event.target.value = '';
        }}
      />
    </>
  );
}
