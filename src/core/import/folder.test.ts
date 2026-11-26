import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/platform', () => ({
  isNativeAndroid: vi.fn(() => false),
}));

import { isNativeAndroid } from '@/lib/platform';
import {
  collectFromDirectory,
  ensureReadPermission,
  fromFileList,
  isBookFile,
  isDirectoryInputSupported,
  isDirectoryPickerSupported,
  type DirectoryCandidate,
} from './folder';

function fileHandle(name: string): FileSystemFileHandle {
  return { name, kind: 'file' } as unknown as FileSystemFileHandle;
}

function directoryHandle(
  name: string,
  children: Array<FileSystemHandle>,
  extra: Record<string, unknown> = {},
): FileSystemDirectoryHandle {
  return {
    name,
    kind: 'directory',
    values: async function* () {
      yield* children;
    },
    ...extra,
  } as unknown as FileSystemDirectoryHandle;
}

function candidate(file: File, path: string): File {
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
}

describe('descubrimiento de libros en carpetas', () => {
  it('acepta los formatos soportados, sin importar mayúsculas', () => {
    expect(isBookFile('Libro.EPUB')).toBe(true);
    expect(isBookFile('capitulo.pdf')).toBe(true);
    expect(isBookFile('notas.txt')).toBe(true);
    expect(isBookFile('borrador.md')).toBe(true);
    expect(isBookFile('portada.jpg')).toBe(false);
  });

  it('conserva la ruta relativa de un input de carpeta', () => {
    const files = [
      candidate(new File(['a'], 'uno.epub'), 'Saga/Vol 1/uno.epub'),
      candidate(new File(['b'], 'dos.pdf'), 'Saga/dos.pdf'),
      candidate(new File(['c'], 'notas.txt'), 'Saga/notas.txt'),
      candidate(new File(['d'], 'ignorado.jpg'), 'Saga/ignorado.jpg'),
    ];

    expect(fromFileList(files).map((item) => item.path)).toEqual([
      'Saga/Vol 1/uno.epub',
      'Saga/dos.pdf',
      'Saga/notas.txt',
    ]);
  });

  it('recorre subdirectorios y respeta el límite de profundidad', async () => {
    const nested = directoryHandle('profundo', [fileHandle('libro.pdf')]);
    const root = directoryHandle('raiz', [
      fileHandle('uno.epub'),
      fileHandle('leeme.txt'),
      nested,
    ]);

    const shallow = await collectFromDirectory(root, 0);
    expect(shallow.map((item) => item.path)).toEqual(['uno.epub', 'leeme.txt']);

    const deep: DirectoryCandidate[] = await collectFromDirectory(root);
    expect(deep.map((item) => item.path)).toEqual([
      'uno.epub',
      'leeme.txt',
      'profundo/libro.pdf',
    ]);
  });

  it('pide permiso solo cuando la raíz guardada no tiene acceso', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const granted = directoryHandle('ok', [], {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission,
    });
    const prompt = directoryHandle('caducada', [], {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission,
    });

    expect(await ensureReadPermission(granted)).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(await ensureReadPermission(prompt)).toBe(true);
    expect(requestPermission).toHaveBeenCalledWith({ name: 'read' });
  });

  it('desactiva el selector de carpetas en Android nativo aunque el WebView anuncie soporte', () => {
    const windowWithPicker = window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> };
    const originalPicker = windowWithPicker.showDirectoryPicker;
    windowWithPicker.showDirectoryPicker = vi.fn() as unknown as () => Promise<FileSystemDirectoryHandle>;
    vi.mocked(isNativeAndroid).mockReturnValue(true);

    expect(isDirectoryPickerSupported()).toBe(false);
    expect(isDirectoryInputSupported()).toBe(false);

    vi.mocked(isNativeAndroid).mockReturnValue(false);
    if (originalPicker === undefined) delete windowWithPicker.showDirectoryPicker;
    else windowWithPicker.showDirectoryPicker = originalPicker;
  });
});
