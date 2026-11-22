import { describe, expect, it, vi } from 'vitest';
import {
  collectFromDirectory,
  ensureReadPermission,
  fromFileList,
  isBookFile,
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
  it('acepta solo EPUB y PDF, sin importar mayúsculas', () => {
    expect(isBookFile('Libro.EPUB')).toBe(true);
    expect(isBookFile('capitulo.pdf')).toBe(true);
    expect(isBookFile('notas.txt')).toBe(false);
  });

  it('conserva la ruta relativa de un input de carpeta', () => {
    const files = [
      candidate(new File(['a'], 'uno.epub'), 'Saga/Vol 1/uno.epub'),
      candidate(new File(['b'], 'dos.pdf'), 'Saga/dos.pdf'),
      candidate(new File(['c'], 'ignorado.txt'), 'Saga/ignorado.txt'),
    ];

    expect(fromFileList(files).map((item) => item.path)).toEqual([
      'Saga/Vol 1/uno.epub',
      'Saga/dos.pdf',
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
    expect(shallow.map((item) => item.path)).toEqual(['uno.epub']);

    const deep: DirectoryCandidate[] = await collectFromDirectory(root);
    expect(deep.map((item) => item.path)).toEqual(['uno.epub', 'profundo/libro.pdf']);
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
});
