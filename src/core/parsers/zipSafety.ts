/** Límites antes de descomprimir ZIP/EPUB/DOCX/ODT (protección contra zip bombs). */

import { ParseError } from './types';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

export const ZIP_LIMITS = {
  maxEntries: 2000,
  maxCompressedBytes: 150 * 1024 * 1024,
  maxUncompressedBytes: 300 * 1024 * 1024,
  maxEntryUncompressedBytes: 100 * 1024 * 1024,
  maxRatio: 250,
} as const;

export interface ZipInspection {
  entries: number;
  compressedBytes: number;
  uncompressedBytes: number;
}

/** Busca el EOCD real: su comentario debe terminar exactamente en el último byte. */
function findEndRecord(view: DataView, length: number): number {
  const start = Math.max(0, length - 65557);
  for (let index = length - 22; index >= start; index -= 1) {
    if (view.getUint32(index, true) !== EOCD_SIGNATURE) continue;
    const commentLength = view.getUint16(index + 20, true);
    if (index + 22 + commentLength === length) return index;
  }
  return -1;
}

function rejectZip64Extra(view: DataView, offset: number, length: number): void {
  let cursor = offset;
  const end = offset + length;
  while (cursor < end) {
    if (cursor + 4 > end) {
      throw new ParseError('El directorio del ZIP está dañado.', 'INVALID_FORMAT');
    }
    const fieldId = view.getUint16(cursor, true);
    const fieldLength = view.getUint16(cursor + 2, true);
    if (fieldId === 0x0001) {
      throw new ParseError('El archivo ZIP usa un formato no soportado (ZIP64).', 'UNKNOWN');
    }
    cursor += 4 + fieldLength;
  }
  if (cursor !== end) {
    throw new ParseError('El directorio del ZIP está dañado.', 'INVALID_FORMAT');
  }
}

/** Lee el directorio central sin descomprimir nada. */
export function inspectZip(bytes: Uint8Array): ZipInspection {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndRecord(view, bytes.byteLength);
  if (eocd < 0) throw new ParseError('El archivo ZIP no es válido.', 'INVALID_FORMAT');

  const entries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  let offset = view.getUint32(eocd + 16, true);
  if (entries === 0xffff || centralSize === 0xffffffff || offset === 0xffffffff) {
    throw new ParseError('El archivo ZIP usa un formato no soportado (ZIP64).', 'UNKNOWN');
  }
  if (entries > ZIP_LIMITS.maxEntries) {
    throw new ParseError('El archivo comprimido tiene demasiadas entradas.', 'UNKNOWN');
  }
  if (offset + centralSize > eocd) {
    throw new ParseError('El directorio del ZIP está dañado.', 'INVALID_FORMAT');
  }

  const inspection: ZipInspection = { entries, compressedBytes: 0, uncompressedBytes: 0 };
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > eocd || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new ParseError('El directorio del ZIP está dañado.', 'INVALID_FORMAT');
    }
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > eocd) {
      throw new ParseError('El directorio del ZIP está dañado.', 'INVALID_FORMAT');
    }

    if (compressed === 0xffffffff || uncompressed === 0xffffffff) {
      throw new ParseError('El archivo ZIP usa un formato no soportado (ZIP64).', 'UNKNOWN');
    }
    rejectZip64Extra(view, offset + 46 + nameLength, extraLength);
    if (uncompressed > ZIP_LIMITS.maxEntryUncompressedBytes) {
      throw new ParseError('Un archivo interior es demasiado grande.', 'UNKNOWN');
    }
    inspection.compressedBytes += compressed;
    inspection.uncompressedBytes += uncompressed;
    if (inspection.compressedBytes > bytes.byteLength) {
      throw new ParseError('El directorio del ZIP está dañado.', 'INVALID_FORMAT');
    }
    if (
      compressed > 0 &&
      uncompressed / compressed > ZIP_LIMITS.maxRatio &&
      uncompressed > 1024 * 1024
    ) {
      throw new ParseError('El archivo comprimido tiene una ratio sospechosa.', 'UNKNOWN');
    }
    offset = entryEnd;
  }
  return inspection;
}

export function assertZipSafety(bytes: Uint8Array): ZipInspection {
  const inspection = inspectZip(bytes);
  if (
    inspection.entries > ZIP_LIMITS.maxEntries ||
    inspection.compressedBytes > ZIP_LIMITS.maxCompressedBytes ||
    inspection.uncompressedBytes > ZIP_LIMITS.maxUncompressedBytes
  ) {
    throw new ParseError('El archivo comprimido es demasiado grande.', 'UNKNOWN');
  }
  return inspection;
}
