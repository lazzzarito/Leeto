import type { SyncProvider, SyncReadResult, SyncWriteResult } from './provider';

let selectedDirectory: FileSystemDirectoryHandle | undefined;

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

function pickerWindow(): DirectoryPickerWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as DirectoryPickerWindow);
}

/** File System Access API (Chromium). En otros navegadores se ofrece export/import manual. */
export function isLocalFolderSupported(): boolean {
  return typeof pickerWindow()?.showDirectoryPicker === 'function';
}

export async function pickSyncDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  const picker = pickerWindow()?.showDirectoryPicker;
  if (!picker) return undefined;
  try {
    const directory = await picker();
    setSyncDirectory(directory);
    return directory;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return undefined;
    throw new Error(
      error instanceof Error ? `No se pudo abrir la carpeta: ${error.message}` : 'No se pudo abrir la carpeta',
    );
  }
}

export function setSyncDirectory(directory?: FileSystemDirectoryHandle): void {
  selectedDirectory = directory;
}

export function getSyncDirectory(): FileSystemDirectoryHandle | undefined {
  return selectedDirectory;
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

function describeError(error: unknown, action: string): Error {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return new Error(`Permiso denegado para ${action} en la carpeta local`);
  }
  return new Error(
    `Carpeta local: no se pudo ${action}: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/** Adaptador sobre un FileSystemDirectoryHandle (inyectable en tests). */
export function createLocalFolderProvider(directory: FileSystemDirectoryHandle): SyncProvider {
  async function readFile(name: string): Promise<SyncReadResult> {
    try {
      const file = await directory.getFileHandle(name);
      return { text: await (await file.getFile()).text() };
    } catch (error) {
      if (isNotFound(error)) return { text: null };
      throw describeError(error, 'leer');
    }
  }

  async function writeFile(name: string, text: string): Promise<SyncWriteResult> {
    try {
      const file = await directory.getFileHandle(name, { create: true });
      const writable = await file.createWritable();
      await writable.write(text);
      await writable.close();
      return {};
    } catch (error) {
      throw describeError(error, 'escribir');
    }
  }

  return {
    id: 'local-folder',
    label: 'Carpeta local',
    read: readFile,

    async exists(name): Promise<boolean> {
      try {
        await directory.getFileHandle(name);
        return true;
      } catch (error) {
        if (isNotFound(error)) return false;
        throw describeError(error, 'comprobar');
      }
    },

    async backupRemote(name, backupName): Promise<void> {
      const current = await readFile(name);
      if (current.text !== null) await writeFile(backupName, current.text);
    },

    async write(name, text): Promise<SyncWriteResult> {
      // La API no ofrece rename atómico: escritura temporal + final + verificación.
      await writeFile(`${name}.tmp`, text);
      await writeFile(name, text);
      const verified = await readFile(name);
      if (verified.text !== text) {
        throw new Error('Carpeta local: la verificación posterior a la escritura no coincide');
      }
      return {};
    },
  };
}
