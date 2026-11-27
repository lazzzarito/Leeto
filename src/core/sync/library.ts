import { db } from '@/core/db/db';
import type { LeetoBook, StoredAsset } from '@/types';
import { MAX_SYNC_TEXT_LENGTH } from './envelope';
import type { SyncProvider } from './provider';

const LIBRARY_PREFIX = 'leeto_book_';

interface LibraryAssetPayload {
  id: string;
  kind: StoredAsset['kind'];
  mimeType: string;
  width?: number;
  height?: number;
  base64: string;
}

interface LibraryFilePayload {
  schemaVersion: 1;
  book: LeetoBook;
  assets: LibraryAssetPayload[];
}

export function libraryFileName(bookId: string): string {
  return `${LIBRARY_PREFIX}${bookId}.json`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function isLibraryPayload(value: unknown): value is LibraryFilePayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Partial<LibraryFilePayload>;
  return (
    payload.schemaVersion === 1 &&
    typeof payload.book?.id === 'string' &&
    Array.isArray(payload.assets) &&
    payload.assets.length <= 20_000
  );
}

/** Serializa un libro completo (capítulos, índice y recursos) para el proveedor. */
export async function buildLibraryFile(bookId: string): Promise<string | undefined> {
  const [book, assets] = await Promise.all([
    db.books.get(bookId),
    db.assets.where('bookId').equals(bookId).toArray(),
  ]);
  if (!book) return undefined;

  const payload: LibraryFilePayload = {
    schemaVersion: 1,
    book,
    assets: await Promise.all(
      assets.map(async (asset) => ({
        id: asset.id,
        kind: asset.kind,
        mimeType: asset.mimeType,
        ...(asset.width === undefined ? {} : { width: asset.width }),
        ...(asset.height === undefined ? {} : { height: asset.height }),
        base64: await blobToBase64(asset.blob),
      })),
    ),
  };
  return JSON.stringify(payload);
}

/** Restaura un libro recibido desde otro dispositivo sin volver a parsear el archivo. */
export async function applyLibraryFile(text: string, expectedId?: string): Promise<boolean> {
  if (text.length > MAX_SYNC_TEXT_LENGTH) {
    throw new Error('El archivo de sincronización es demasiado grande');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  if (!isLibraryPayload(parsed) || (expectedId && parsed.book.id !== expectedId)) return false;

  const assets: StoredAsset[] = parsed.assets.map((asset) => ({
    id: asset.id,
    bookId: parsed.book.id,
    kind: asset.kind,
    mimeType: asset.mimeType,
    blob: base64ToBlob(asset.base64, asset.mimeType),
    ...(asset.width === undefined ? {} : { width: asset.width }),
    ...(asset.height === undefined ? {} : { height: asset.height }),
    createdAt: parsed.book.importedAt,
  }));

  await db.transaction('rw', db.books, db.assets, async () => {
    await db.books.put(parsed.book);
    if (assets.length) await db.assets.bulkPut(assets);
  });
  return true;
}

export interface LibrarySyncStats {
  uploaded: number;
  applied: number;
}

/**
 * Sube los libros que el proveedor aún no tiene y restaura los que solo existen
 * en el sobre remoto. Requiere un proveedor con soporte binario (carpeta local).
 */
export async function syncLibraryFiles(
  provider: SyncProvider,
  refs: NonNullable<import('@/types').SyncEnvelope['libraryRefs']>,
): Promise<LibrarySyncStats> {
  if (!provider.readBlob || !provider.writeBlob) {
    throw new Error(`${provider.label} no puede sincronizar los archivos de la biblioteca`);
  }

  const stats: LibrarySyncStats = { uploaded: 0, applied: 0 };
  const localBooks = await db.books.toArray();
  const localById = new Map(localBooks.map((book) => [book.id, book]));
  const processed = new Set<string>();

  const upload = async (book: LeetoBook) => {
    const text = await buildLibraryFile(book.id);
    if (!text) return;
    if (text.length > MAX_SYNC_TEXT_LENGTH) {
      throw new Error(`El libro «${book.title}» es demasiado grande para sincronizar`);
    }
    await provider.writeBlob!(
      libraryFileName(book.id),
      new Blob([text], { type: 'application/json' }),
    );
    stats.uploaded += 1;
  };

  for (const ref of Object.values(refs)) {
    processed.add(ref.id);
    const blob = await provider.readBlob!(libraryFileName(ref.id));
    const local = localById.get(ref.id);

    if (!blob) {
      if (local) await upload(local);
      continue;
    }
    if (blob.size > MAX_SYNC_TEXT_LENGTH) {
      throw new Error(`El libro remoto «${ref.fileName}» es demasiado grande`);
    }
    if (!local || ref.updatedAt > local.updatedAt) {
      if (await applyLibraryFile(await blob.text(), ref.id)) stats.applied += 1;
    } else if (local.updatedAt > ref.updatedAt) {
      await upload(local);
    }
  }

  for (const book of localBooks) {
    if (!processed.has(book.id)) await upload(book);
  }

  return stats;
}
