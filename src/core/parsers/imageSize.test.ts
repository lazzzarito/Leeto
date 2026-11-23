import { describe, expect, it } from 'vitest';
import { readImageSize } from './imageSize';
import type { ByteArray } from './types';

function ascii(bytes: ByteArray, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
}

function png(width: number, height: number): ByteArray {
  const bytes = new Uint8Array(24);
  ascii(bytes, 0, '\u0089PNG\r\n\u001a\n');
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number): ByteArray {
  const bytes = new Uint8Array(20);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0);
  bytes[7] = height >> 8;
  bytes[8] = height & 0xff;
  bytes[9] = width >> 8;
  bytes[10] = width & 0xff;
  return bytes;
}

function gif(width: number, height: number): ByteArray {
  const bytes = new Uint8Array(13);
  ascii(bytes, 0, 'GIF89a');
  bytes[6] = width & 0xff;
  bytes[7] = width >> 8;
  bytes[8] = height & 0xff;
  bytes[9] = height >> 8;
  return bytes;
}

function bmp(width: number, height: number): ByteArray {
  const bytes = new Uint8Array(26);
  ascii(bytes, 0, 'BM');
  const view = new DataView(bytes.buffer);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  return bytes;
}

function webp(width: number, height: number): ByteArray {
  const bytes = new Uint8Array(30);
  ascii(bytes, 0, 'RIFF');
  ascii(bytes, 8, 'WEBP');
  ascii(bytes, 12, 'VP8X');
  bytes[24] = (width - 1) & 0xff;
  bytes[25] = ((width - 1) >> 8) & 0xff;
  bytes[26] = ((width - 1) >> 16) & 0xff;
  bytes[27] = (height - 1) & 0xff;
  bytes[28] = ((height - 1) >> 8) & 0xff;
  bytes[29] = ((height - 1) >> 16) & 0xff;
  return bytes;
}

function avif(width: number, height: number): ByteArray {
  const bytes = new Uint8Array(24);
  ascii(bytes, 8, 'ispe');
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe('readImageSize', () => {
  it('lee las dimensiones de los formatos habituales', () => {
    expect(readImageSize(png(1200, 800))).toEqual({ width: 1200, height: 800 });
    expect(readImageSize(jpeg(250, 300))).toEqual({ width: 250, height: 300 });
    expect(readImageSize(gif(12, 34))).toEqual({ width: 12, height: 34 });
    expect(readImageSize(bmp(640, 480))).toEqual({ width: 640, height: 480 });
    expect(readImageSize(webp(1024, 768))).toEqual({ width: 1024, height: 768 });
    expect(readImageSize(avif(900, 600))).toEqual({ width: 900, height: 600 });
  });

  it('devuelve null para datos que no son una imagen reconocida', () => {
    expect(readImageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});
