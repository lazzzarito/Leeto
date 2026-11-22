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

/** Lee el directorio central sin descomprimir nada. */
export function inspectZip(bytes: Uint8Array): ZipInspection {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const start = Math.max(0, bytes.byteLength - 65557);
  for (let index = bytes.byteLength - 22; index >= start; index -= 1) {
    if (view.getUint32(index, true) === EOCD_SIGNATURE) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new ParseError('El archivo ZIP no es válido.', 'INVALID_FORMAT');

  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (entries === 0xffff || offset === 0xffffffff) {
    throw new ParseError('El archivo ZIP usa un formato no soportado (ZIP64).', 'UNKNOWN');
  }

  const inspection: ZipInspection = { entries, compressedBytes: 0, uncompressedBytes: 0 };
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new ParseError('El directorio del ZIP está dañado.', 'INVALID_FORMAT');
    }
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);

    if (compressed === 0xffffffff || uncompressed === 0xffffffff) {
      throw new ParseError('El archivo ZIP usa un formato no soportado (ZIP64).', 'UNKNOWN');
    }
    if (uncompressed > ZIP_LIMITS.maxEntryUncompressedBytes) {
      throw new ParseError('Un archivo interior es demasiado grande.', 'UNKNOWN');
    }
    inspection.compressedBytes += compressed;
    inspection.uncompressedBytes += uncompressed;
    if (
      compressed > 0 &&
      uncompressed / compressed > ZIP_LIMITS.maxRatio &&
      uncompressed > 1024 * 1024
    ) {
      throw new ParseError('El archivo comprimido tiene una ratio sospechosa.', 'UNKNOWN');
    }
    offset += 46 + nameLength + extraLength + commentLength;
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
