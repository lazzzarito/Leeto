import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseCbz } from './cbz';
import { CBZ_MIME } from './formats';
import { ParseError, type ParseProgress, type ParseRequest } from './types';

function pngBytes(): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 8);
  view.setUint32(20, 8);
  return bytes;
}

async function cbzFixture(names: string[]): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new JSZip();
  for (const name of names) zip.file(name, pngBytes());
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
}

function request(bytes: Uint8Array<ArrayBuffer>): ParseRequest {
  return {
    contentHash: 'sha256:cbz',
    fileName: 'Mi comic.cbz',
    fileSize: bytes.byteLength,
    mimeType: CBZ_MIME,
    bytes,
  };
}

describe('parseCbz', () => {
  it('extrae las páginas en orden natural e ignorando archivos que no son imágenes', async () => {
    const bytes = await cbzFixture([
      'page1.png',
      'page10.jpg',
      'page2.webp',
      'page3.bmp',
      'page4.avif',
      'notas.txt',
    ]);
    const progress: ParseProgress[] = [];
    const result = await parseCbz(request(bytes), (item) => progress.push(item));

    expect(result.title).toBe('Mi comic');
    expect(result.author).toBe('');
    expect(result.totalWordCount).toBe(0);
    expect(result.coverAssetId).toBe(result.assets[0]?.id);
    expect(result.assets.map((asset) => asset.mimeType)).toEqual([
      'image/png',
      'image/webp',
      'image/bmp',
      'image/avif',
      'image/jpeg',
    ]);
    expect(
      result.chapters[0]?.blocks.map((block) =>
        block.type === 'image' ? block.alt : '',
      ),
    ).toEqual(['page1.png', 'page2.webp', 'page3.bmp', 'page4.avif', 'page10.jpg']);
    expect(progress.some((item) => item.stage === 'extracting-assets')).toBe(true);
  });

  it('ordena las páginas igual con cualquier locale del dispositivo', async () => {
    const bytes = await cbzFixture([
      'page10.png',
      'Page2.png',
      'page1.png',
      'page02.png',
    ]);
    const result = await parseCbz(request(bytes), () => {});

    expect(result.chapters[0]?.blocks.map((block) => (block.type === 'image' ? block.alt : ''))).toEqual([
      'page1.png',
      'Page2.png',
      'page02.png',
      'page10.png',
    ]);
  });

  it('guarda las dimensiones leídas de cada página', async () => {
    const result = await parseCbz(request(await cbzFixture(['portada.png'])), () => {});

    expect(result.assets[0]).toMatchObject({ width: 8, height: 8 });
  });

  it('rechaza imágenes que declaran demasiados píxeles', async () => {
    const zip = new JSZip();
    const huge = pngBytes();
    new DataView(huge.buffer).setUint32(16, 100_000);
    new DataView(huge.buffer).setUint32(20, 100_000);
    zip.file('gigante.png', huge);
    const bytes = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));

    await expect(parseCbz(request(bytes), () => {})).rejects.toThrow(/demasiado grande/i);
  });

  it('rechaza un CBZ sin imágenes legibles', async () => {
    const bytes = await cbzFixture(['notas.txt']);

    await expect(parseCbz(request(bytes), () => {})).rejects.toBeInstanceOf(ParseError);
  });
});
