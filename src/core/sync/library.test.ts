import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import type { LeetoBook, SyncEnvelope } from '@/types';
import { applyLibraryFile, buildLibraryFile, libraryFileName, syncLibraryFiles } from './library';
import type { SyncProvider } from './provider';

const BOOK_ID = 'book-1';

const book: LeetoBook = {
  id: BOOK_ID,
  contentHash: BOOK_ID,
  title: 'Prueba',
  author: 'Autor',
  fileName: 'prueba.epub',
  fileSize: 1024,
  mimeType: 'application/epub+zip',
  chapters: [
    { index: 0, title: 'Capítulo', blocks: [{ id: 'b1', type: 'text', content: 'Hola', wordCount: 1 }] },
  ],
  totalWordCount: 1,
  importedAt: 100,
  updatedAt: 200,
};

function memoryProvider(): SyncProvider & { files: Map<string, Blob> } {
  const files = new Map<string, Blob>();
  return {
    id: 'local-folder',
    label: 'Memoria',
    files,
    async read() {
      return { text: null };
    },
    async write() {
      return {};
    },
    async exists(name) {
      return files.has(name);
    },
    async readBlob(name) {
      return files.get(name) ?? null;
    },
    async writeBlob(name, blob) {
      files.set(name, blob);
    },
  };
}

beforeAll(() => {
  // fake-indexeddb clona con structuredClone de Node: el Blob de jsdom pierde sus bytes.
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
});

beforeEach(async () => {
  await Promise.all([db.books.clear(), db.assets.clear()]);
});

describe('library sync', () => {
  it('serializa y restaura capítulos y recursos', async () => {
    await db.books.put(book);
    await db.assets.put({
      id: 'asset-1',
      bookId: BOOK_ID,
      kind: 'cover',
      mimeType: 'text/plain',
      blob: new Blob(['portada']),
      createdAt: 100,
    });

    const text = await buildLibraryFile(BOOK_ID);
    expect(text).toContain('"base64"');

    await db.books.clear();
    await db.assets.clear();
    expect(await applyLibraryFile(text!)).toBe(true);

    expect(await db.books.get(BOOK_ID)).toEqual(book);
    const asset = await db.assets.get('asset-1');
    expect(await asset?.blob.text()).toBe('portada');
  });

  it('sube libros locales y restaura los que solo están en el sobre', async () => {
    const provider = memoryProvider();
    await db.books.put(book);
    const refs: NonNullable<SyncEnvelope['libraryRefs']> = {
      [BOOK_ID]: { id: BOOK_ID, fileName: book.fileName, fileSize: book.fileSize, updatedAt: 200 },
    };

    expect(await syncLibraryFiles(provider, refs)).toEqual({ uploaded: 1, applied: 0 });
    expect(provider.files.has(libraryFileName(BOOK_ID))).toBe(true);

    await db.books.clear();
    expect(await syncLibraryFiles(provider, refs)).toEqual({ uploaded: 0, applied: 1 });
    expect(await db.books.get(BOOK_ID)).toEqual(book);
  });

  it('aplica la versión remota más reciente y sube la local cuando gana', async () => {
    const provider = memoryProvider();
    const remote = { ...book, title: 'Remoto', updatedAt: 300 };
    const remoteText = JSON.stringify({ schemaVersion: 1, book: remote, assets: [] });
    provider.files.set(libraryFileName(BOOK_ID), new Blob([remoteText], { type: 'application/json' }));
    await db.books.put(book);

    const newerRemoteRefs: NonNullable<SyncEnvelope['libraryRefs']> = {
      [BOOK_ID]: { id: BOOK_ID, fileName: remote.fileName, fileSize: remote.fileSize, updatedAt: 300 },
    };
    expect(await syncLibraryFiles(provider, newerRemoteRefs)).toEqual({ uploaded: 0, applied: 1 });
    expect((await db.books.get(BOOK_ID))?.title).toBe('Remoto');

    const local = { ...book, title: 'Local', updatedAt: 400 };
    await db.books.put(local);
    const olderRemoteRefs: NonNullable<SyncEnvelope['libraryRefs']> = {
      [BOOK_ID]: { id: BOOK_ID, fileName: remote.fileName, fileSize: remote.fileSize, updatedAt: 300 },
    };
    expect(await syncLibraryFiles(provider, olderRemoteRefs)).toEqual({ uploaded: 1, applied: 0 });
    const uploadedText = await provider.files.get(libraryFileName(BOOK_ID))?.text();
    expect(uploadedText).toContain('Local');
  });

  it('rechaza archivos de libro con id distinto al ref', async () => {
    const text = JSON.stringify({
      schemaVersion: 1,
      book: { ...book, id: 'otro' },
      assets: [],
    });
    expect(await applyLibraryFile(text, BOOK_ID)).toBe(false);
  });
});
