import type { LeetoBook, ReadingProgress, SavedQuote, SyncEnvelope } from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createEmptyEnvelope(deviceId: string, updatedAt = Date.now()): SyncEnvelope {
  return {
    schemaVersion: 1,
    updatedAt,
    originDeviceId: deviceId,
    devices: { [deviceId]: updatedAt },
    progress: {},
    quotes: {},
    libraryRefs: {},
  };
}

export interface BuildEnvelopeInput {
  deviceId: string;
  progress: ReadingProgress[];
  quotes: SavedQuote[];
  books: LeetoBook[];
  updatedAt?: number;
}

/** Serializa el estado local al sobre portable (incluye tombstones de citas). */
export function buildEnvelope({
  deviceId,
  progress,
  quotes,
  books,
  updatedAt = Date.now(),
}: BuildEnvelopeInput): SyncEnvelope {
  return {
    schemaVersion: 1,
    updatedAt,
    originDeviceId: deviceId,
    devices: { [deviceId]: updatedAt },
    progress: Object.fromEntries(progress.map((item) => [item.bookId, item])),
    quotes: Object.fromEntries(quotes.map((item) => [item.id, item])),
    libraryRefs: Object.fromEntries(
      books.map((book) => [
        book.id,
        {
          id: book.id,
          fileName: book.fileName,
          fileSize: book.fileSize,
          updatedAt: book.updatedAt,
        },
      ]),
    ),
  };
}

export function serializeEnvelope(envelope: SyncEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/** Parsea y valida la forma mínima del sobre; lanza si el JSON es inválido. */
export function parseEnvelope(text: string): SyncEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo de sincronización no contiene JSON válido');
  }

  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== 1 ||
    typeof parsed.originDeviceId !== 'string' ||
    typeof parsed.updatedAt !== 'number' ||
    !isRecord(parsed.devices) ||
    !isRecord(parsed.progress) ||
    !isRecord(parsed.quotes)
  ) {
    throw new Error('Sobre de sincronización inválido o de versión no soportada');
  }

  return parsed as unknown as SyncEnvelope;
}

export function envelopeToBlob(envelope: SyncEnvelope): Blob {
  return new Blob([serializeEnvelope(envelope)], { type: 'application/json' });
}
