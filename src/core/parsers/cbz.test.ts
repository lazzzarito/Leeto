import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseCbz } from './cbz';
import { CBZ_MIME } from './formats';
import { ParseError, type ParseProgress, type ParseRequest } from './types';

async function cbzFixture(names: string[]): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new JSZip();
  for (const name of names) zip.file(name, new Uint8Array([1, 2, 3]));
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

  it('rechaza un CBZ sin imágenes legibles', async () => {
    const bytes = await cbzFixture(['notas.txt']);

    await expect(parseCbz(request(bytes), () => {})).rejects.toBeInstanceOf(ParseError);
  });
});
