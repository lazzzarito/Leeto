import { describe, expect, it } from 'vitest';
import { createLocalFolderProvider } from './localFolder';

class FakeFileHandle {
  content = '';

  async getFile(): Promise<File> {
    return new File([this.content], 'leeto_sync.json', { type: 'application/json' });
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    return {
      write: async (chunk: string | Blob) => {
        this.content = typeof chunk === 'string' ? chunk : await chunk.text();
      },
      close: async () => undefined,
    } as unknown as FileSystemWritableFileStream;
  }
}

class FakeDirectoryHandle {
  readonly files = new Map<string, FakeFileHandle>();

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FakeFileHandle> {
    let file = this.files.get(name);
    if (!file) {
      if (!options?.create) throw new DOMException('No existe', 'NotFoundError');
      file = new FakeFileHandle();
      this.files.set(name, file);
    }
    return file;
  }
}

function directory(): FileSystemDirectoryHandle {
  return new FakeDirectoryHandle() as unknown as FileSystemDirectoryHandle;
}

describe('conector de carpeta local', () => {
  it('lee un archivo ausente como null y detecta existencia', async () => {
    const sync = createLocalFolderProvider(directory());
    expect(await sync.read('leeto_sync.json')).toEqual({ text: null });
    expect(await sync.exists('leeto_sync.json')).toBe(false);
  });

  it('escribe con verificación y mantiene una copia de backup', async () => {
    const dir = new FakeDirectoryHandle();
    const sync = createLocalFolderProvider(dir as unknown as FileSystemDirectoryHandle);

    const first = '{"schemaVersion":1,"version":1}';
    await sync.write('leeto_sync.json', first);
    expect(dir.files.get('leeto_sync.json')?.content).toBe(first);
    expect(dir.files.get('leeto_sync.json.tmp')?.content).toBe(first);

    await sync.backupRemote?.('leeto_sync.json', 'leeto_sync.backup.json');
    expect(dir.files.get('leeto_sync.backup.json')?.content).toBe(first);

    const second = '{"schemaVersion":1,"version":2}';
    await sync.write('leeto_sync.json', second);
    expect((await sync.read('leeto_sync.json')).text).toBe(second);
    expect((await sync.read('leeto_sync.backup.json')).text).toBe(first);
  });

  it('traduce errores de permiso a un mensaje accionable', async () => {
    const dir = new FakeDirectoryHandle();
    dir.getFileHandle = async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
    const sync = createLocalFolderProvider(dir as unknown as FileSystemDirectoryHandle);
    await expect(sync.read('leeto_sync.json')).rejects.toThrow(/Permiso denegado/);
  });
});
