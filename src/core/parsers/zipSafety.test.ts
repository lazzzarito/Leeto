import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { assertZipSafety, inspectZip } from './zipSafety';

async function smallZip(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('hola.txt', 'contenido pequeño');
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
}

function centralDirectoryOffset(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = bytes.byteLength - 22; index >= 0; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) return view.getUint32(index + 16, true);
  }
  throw new Error('EOCD no encontrado');
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

  it('rechaza un archivo que no es ZIP', () => {
    expect(() => assertZipSafety(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
