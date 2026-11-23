import type { LeetoBook, ReadingProgress, SavedQuote, SyncEnvelope } from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || isNumber(value);
}

export function isValidProgress(value: unknown): value is ReadingProgress {
  if (!isRecord(value)) return false;
  return (
    isText(value.bookId) &&
    isNumber(value.chapterIndex) &&
    value.chapterIndex >= 0 &&
    isText(value.blockId) &&
    isNumber(value.percentage) &&
    value.percentage >= 0 &&
    value.percentage <= 100 &&
    isNumber(value.updatedAt) &&
    isText(value.deviceId) &&
    isOptionalText(value.segmentIndex)
  );
}

export function isValidQuote(value: unknown): value is SavedQuote {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    isText(value.bookId) &&
    isNumber(value.chapterIndex) &&
    value.chapterIndex >= 0 &&
    isText(value.blockId) &&
    typeof value.excerpt === 'string' &&
    isOptionalText(value.note) &&
    isNumber(value.createdAt) &&
    isNumber(value.updatedAt) &&
    isOptionalNumber(value.deletedAt)
  );
}

function isValidLibraryRef(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    isText(value.fileName) &&
    isNumber(value.fileSize) &&
    value.fileSize >= 0 &&
    isNumber(value.updatedAt)
  );
}

function hasOnlyValidRecords(
  records: Record<string, unknown> | undefined,
  isValid: (value: unknown) => boolean,
): boolean {
  return records === undefined || Object.values(records).every(isValid);
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
    !isText(parsed.originDeviceId) ||
    !isNumber(parsed.updatedAt) ||
    !isRecord(parsed.devices) ||
    !isRecord(parsed.progress) ||
    !isRecord(parsed.quotes) ||
    !Object.values(parsed.devices).every(isNumber) ||
    !hasOnlyValidRecords(parsed.progress, isValidProgress) ||
    !hasOnlyValidRecords(parsed.quotes, isValidQuote) ||
    (parsed.libraryRefs !== undefined &&
      (!isRecord(parsed.libraryRefs) ||
        !hasOnlyValidRecords(parsed.libraryRefs, isValidLibraryRef)))
  ) {
    throw new Error('Sobre de sincronización inválido o de versión no soportada');
  }

  return parsed as unknown as SyncEnvelope;
}

export function envelopeToBlob(envelope: SyncEnvelope): Blob {
  return new Blob([serializeEnvelope(envelope)], { type: 'application/json' });
}
