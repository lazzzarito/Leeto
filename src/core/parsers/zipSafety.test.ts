import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { assertZipSafety, inspectZip } from './zipSafety';

async function smallZip(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('hola.txt', 'contenido pequeño');
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
}

function findEndRecord(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = bytes.byteLength - 22; index >= 0; index -= 1) {
    if (view.getUint32(index, true) !== 0x06054b50) continue;
    if (index + 22 + view.getUint16(index + 20, true) === bytes.byteLength) return index;
  }
  throw new Error('EOCD no encontrado');
}

function centralDirectoryOffset(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(findEndRecord(bytes) + 16, true);
}

function copyWithEocdChange(
  bytes: Uint8Array,
  change: (view: DataView, eocd: number) => void,
): Uint8Array {
  const result = new Uint8Array(bytes);
  const view = new DataView(result.buffer);
  change(view, findEndRecord(result));
  return result;
}

describe('assertZipSafety', () => {
  it('acepta un ZIP pequeño y cuenta sus entradas', async () => {
    const bytes = await smallZip();
    expect(inspectZip(bytes).entries).toBe(1);
    expect(() => assertZipSafety(bytes)).not.toThrow();
  });

  it('rechaza una ratio de compresión sospechosa sin descomprimir', async () => {
    const bytes = await smallZip();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint32(centralDirectoryOffset(bytes) + 24, 20 * 1024 * 1024, true);
    expect(() => assertZipSafety(bytes)).toThrow(/ratio/i);
  });

  it('ignora un EOCD falso escondido en el comentario', async () => {
    const bytes = await smallZip();
    const eocd = findEndRecord(bytes);
    const comment = new Uint8Array(32);
    comment.set([0x50, 0x4b, 0x05, 0x06], 8);
    const result = new Uint8Array(bytes.length + comment.length);
    result.set(bytes, 0);
    result.set(comment, bytes.length);
    const view = new DataView(result.buffer);
    view.setUint16(eocd + 20, comment.length, true);

    expect(() => assertZipSafety(result)).not.toThrow();
    expect(inspectZip(result).entries).toBe(1);
  });

  it('rechaza un directorio central que no cabe antes del EOCD', async () => {
    const bytes = await smallZip();
    const broken = copyWithEocdChange(bytes, (view, eocd) => {
      view.setUint32(eocd + 12, 1024 * 1024, true);
    });

    expect(() => assertZipSafety(broken)).toThrow(/directorio/i);
  });

  it('rechaza entradas con campo extra ZIP64', async () => {
    const bytes = await smallZip();
    const central = centralDirectoryOffset(bytes);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const nameLength = view.getUint16(central + 28, true);
    const insertAt = central + 46 + nameLength;
    const extra = new Uint8Array([0x01, 0x00, 0x00, 0x00]);
    const result = new Uint8Array(bytes.length + extra.length);
    result.set(bytes.subarray(0, insertAt), 0);
    result.set(extra, insertAt);
    result.set(bytes.subarray(insertAt), insertAt + extra.length);
    const resultView = new DataView(result.buffer);
    const eocd = findEndRecord(result);
    resultView.setUint16(central + 30, extra.length, true);
    resultView.setUint32(eocd + 12, resultView.getUint32(eocd + 12, true) + extra.length, true);

    expect(() => assertZipSafety(result)).toThrow(/ZIP64/i);
  });

  it('rechaza un archivo que no es ZIP', () => {
    expect(() => assertZipSafety(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
