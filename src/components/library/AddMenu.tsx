import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FolderOpen, FolderSearch, Plus, Upload } from 'lucide-react';
import { useRef } from 'react';
import { fromFileList } from '@/core/import/folder';

interface AddMenuProps {
  onFiles: (files: File[]) => void;
  onPickFolder: () => void;
  onOpenScan: () => void;
  nativeFolderPicker: boolean;
}

const ITEM_CLASS =
  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-accent';

export default function AddMenu({
  onFiles,
  onPickFolder,
  onOpenScan,
  nativeFolderPicker,
}: AddMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="border-border hover:bg-muted inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium"
          >
            <Plus className="size-4" aria-hidden="true" />
            Añadir
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="bg-popover text-popover-foreground z-[70] min-w-56 rounded-lg border border-border p-1.5 shadow-xl"
          >
            <DropdownMenu.Item className={ITEM_CLASS} onSelect={() => fileInputRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              Archivos EPUB/PDF
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={ITEM_CLASS}
              onSelect={() => {
                if (nativeFolderPicker) onPickFolder();
                else folderInputRef.current?.click();
              }}
            >
              <FolderOpen className="size-4" aria-hidden="true" />
              Carpeta completa
            </DropdownMenu.Item>
            <DropdownMenu.Item className={ITEM_CLASS} onSelect={onOpenScan}>
              <FolderSearch className="size-4" aria-hidden="true" />
              Escanear raíces guardadas
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.pdf,application/epub+zip,application/pdf"
        multiple
        hidden
        className="sr-only"
        aria-label="Seleccionar archivos EPUB o PDF"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = '';
        }}
      />
      <input
        ref={(element) => element?.setAttribute('webkitdirectory', '')}
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
