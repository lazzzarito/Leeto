import type { ByteArray } from './types';

export interface ImageSize {
  width: number;
  height: number;
}

const MAX_DIMENSION = 100_000;

function matches(bytes: ByteArray, offset: number, text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

function valid(width: number, height: number): ImageSize | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) return null;
  return { width, height };
}

function pngSize(bytes: ByteArray): ImageSize | null {
  if (bytes.length < 24 || !matches(bytes, 0, '\u0089PNG\r\n\u001a\n')) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return valid(view.getUint32(16), view.getUint32(20));
}

function jpegSize(bytes: ByteArray): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let cursor = 2;
  while (cursor + 9 < bytes.length) {
    if (bytes[cursor] !== 0xff) {
      cursor += 1;
      continue;
    }
    while (bytes[cursor] === 0xff) cursor += 1;
    const marker = bytes[cursor];
    cursor += 1;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (cursor + 2 > bytes.length) return null;
    const segmentLength = (bytes[cursor]! << 8) | bytes[cursor + 1]!;
    const sof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (sof && cursor + 7 <= bytes.length) {
      return valid(
        (bytes[cursor + 5]! << 8) | bytes[cursor + 6]!,
        (bytes[cursor + 3]! << 8) | bytes[cursor + 4]!,
      );
    }
    if (segmentLength < 2) return null;
    cursor += segmentLength;
  }
  return null;
}

function gifSize(bytes: ByteArray): ImageSize | null {
  if (bytes.length < 10 || (!matches(bytes, 0, 'GIF87a') && !matches(bytes, 0, 'GIF89a'))) {
    return null;
  }
  return valid(bytes[6]! | (bytes[7]! << 8), bytes[8]! | (bytes[9]! << 8));
}

function bmpSize(bytes: ByteArray): ImageSize | null {
  if (bytes.length < 26 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return valid(Math.abs(view.getInt32(18, true)), Math.abs(view.getInt32(22, true)));
}

function webpSize(bytes: ByteArray): ImageSize | null {
  if (
    bytes.length < 30 ||
    !matches(bytes, 0, 'RIFF') ||
    !matches(bytes, 8, 'WEBP')
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (matches(bytes, 12, 'VP8X')) {
    const width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
    const height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
    return valid(width, height);
  }
  if (matches(bytes, 12, 'VP8L') && bytes[20] === 0x2f) {
    const bits = view.getUint32(21, true);
    return valid((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (matches(bytes, 12, 'VP8 ') && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return valid(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
  }
  return null;
}

function avifSize(bytes: ByteArray): ImageSize | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 4; index + 16 <= bytes.length; index += 1) {
    if (!matches(bytes, index, 'ispe')) continue;
    return valid(view.getUint32(index + 8), view.getUint32(index + 12));
  }
  return null;
}

/** Lee las dimensiones de la cabecera sin decodificar la imagen. */
export function readImageSize(bytes: ByteArray): ImageSize | null {
  return (
    pngSize(bytes) ??
    jpegSize(bytes) ??
    gifSize(bytes) ??
    bmpSize(bytes) ??
    webpSize(bytes) ??
    avifSize(bytes)
  );
}
