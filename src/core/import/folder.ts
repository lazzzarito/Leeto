/** Descubrimiento de libros en carpetas, sin depender de React ni de la UI. */

import { isBookFile } from '@/core/parsers/formats';
import { isNativeAndroid } from '@/lib/platform';

export { isBookFile };

export interface BookCandidate {
  file: File;
  path: string;
}

export interface DirectoryCandidate {
  handle: FileSystemFileHandle;
  path: string;
}

type DirectoryValues = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemHandle>;
};

type PermissionCapableHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { name: 'read'; mode?: 'read' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { name: 'read'; mode?: 'read' }) => Promise<PermissionState>;
};

/** Normaliza un `<input webkitdirectory>` a rutas relativas estables. */
export function fromFileList(files: File[]): BookCandidate[] {
  return files
    .filter((file) => isBookFile(file.name))
    .map((file) => ({
      file,
      path: file.webkitRelativePath || file.name,
    }));
}

/** Recorre un FileSystemDirectoryHandle con un límite de profundidad. */
export async function collectFromDirectory(
  directory: FileSystemDirectoryHandle,
  maxDepth = 8,
): Promise<DirectoryCandidate[]> {
  const found: DirectoryCandidate[] = [];

  const walk = async (
    current: FileSystemDirectoryHandle,
    prefix: string,
    depth: number,
  ): Promise<void> => {
    if (depth > maxDepth) return;
    const entries = (current as DirectoryValues).values?.();
    if (!entries) return;

    for await (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'file' && isBookFile(entry.name)) {
        found.push({ handle: entry as FileSystemFileHandle, path });
      } else if (entry.kind === 'directory') {
        await walk(entry as FileSystemDirectoryHandle, path, depth + 1);
      }
    }
  };

  await walk(directory, '', 0);
  return found;
}

/** Las raíces guardadas pueden haber caducado: revalidamos antes de escanear. */
export async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const capable = handle as PermissionCapableHandle;
  if (!capable.queryPermission || !capable.requestPermission) return true;
  const descriptor = { name: 'read' as const };
  if ((await capable.queryPermission(descriptor)) === 'granted') return true;
  return (await capable.requestPermission(descriptor)) === 'granted';
}

export function isDirectoryPickerSupported(): boolean {
  // Android WebView/Capacitor no expone un selector de carpetas fiable por File System Access.
  if (isNativeAndroid()) return false;
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Safari/Firefox y algunos móviles no tienen el selector nativo, pero sí `<input webkitdirectory>`.
 * Android WebView suele anunciar el atributo sin soportar realmente la selección de carpetas.
 */
export function isDirectoryInputSupported(): boolean {
  if (isNativeAndroid()) return false;
  if (typeof document === 'undefined') return false;
  const input = document.createElement('input');
  return 'webkitdirectory' in input || 'directory' in input;
}

/** Devuelve `undefined` cuando la persona cancela el selector nativo. */
export async function pickBookDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  const picker = (
    window as Window & {
      showDirectoryPicker?: (options?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) return undefined;
  try {
    return await picker.call(window, { mode: 'read' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return undefined;
    throw new Error(
      error instanceof Error ? `No se pudo abrir la carpeta: ${error.message}` : 'No se pudo abrir la carpeta',
    );
  }
}
