import type { LeetoBook, ReadingProgress, SavedQuote, SyncEnvelope } from '@/types';

/** Límites explícitos para no confiar en el tamaño de un archivo remoto o importado. */
export const MAX_SYNC_TEXT_LENGTH = 10 * 1024 * 1024;
const MAX_RECORDS = 20_000;
const MAX_ID_LENGTH = 512;
const MAX_FIELD_LENGTH = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length <= MAX_RECORDS;
}

function isText(value: unknown, maxLength = MAX_ID_LENGTH): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalText(value: unknown, maxLength = MAX_ID_LENGTH): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || isNumber(value);
}

function isOptionalSegmentIndex(value: unknown): boolean {
  return value === undefined || (isNumber(value) && Number.isInteger(value) && value >= 0);
}

function isOptionalStatus(value: unknown): boolean {
  return (
    value === undefined || value === 'unread' || value === 'reading' || value === 'finished'
  );
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
    isOptionalSegmentIndex(value.segmentIndex) &&
    (value.elapsedMs === undefined || (isNumber(value.elapsedMs) && value.elapsedMs >= 0)) &&
    isOptionalNumber(value.deletedAt) &&
    isOptionalStatus(value.status)
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
    value.excerpt.length <= MAX_FIELD_LENGTH &&
    isOptionalText(value.note, MAX_FIELD_LENGTH) &&
    isNumber(value.createdAt) &&
    isNumber(value.updatedAt) &&
    isOptionalNumber(value.deletedAt)
  );
}

function isValidLibraryRef(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    isText(value.fileName, MAX_FIELD_LENGTH) &&
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
  if (text.length > MAX_SYNC_TEXT_LENGTH) {
    throw new Error('El archivo de sincronización es demasiado grande');
  }
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
    !isBoundedRecord(parsed.devices) ||
    !isBoundedRecord(parsed.progress) ||
    !isBoundedRecord(parsed.quotes) ||
    !Object.values(parsed.devices).every(isNumber) ||
    !hasOnlyValidRecords(parsed.progress, isValidProgress) ||
    !hasOnlyValidRecords(parsed.quotes, isValidQuote) ||
    (parsed.libraryRefs !== undefined &&
      (!isBoundedRecord(parsed.libraryRefs) ||
        !hasOnlyValidRecords(parsed.libraryRefs, isValidLibraryRef)))
  ) {
    throw new Error('Sobre de sincronización inválido o de versión no soportada');
  }

  return parsed as unknown as SyncEnvelope;
}

export function envelopeToBlob(envelope: SyncEnvelope): Blob {
  return new Blob([serializeEnvelope(envelope)], { type: 'application/json' });
}
