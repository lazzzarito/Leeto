/** Parser de cómics CBZ: páginas de imagen con orden natural y progreso por página. */

import JSZip from 'jszip';
import { newId } from '@/lib/ids';
import { readImageSize } from './imageSize';
import { guessMimeType, makeBlockIdFactory } from './normalize';
import { ParseError, type ParseProgress, type ParseRequest, type ParseResult } from './types';
import { assertZipSafety } from './zipSafety';

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_TOTAL_PIXELS = 250_000_000;

/** Orden natural por code point: el mismo CBZ se ordena igual en cualquier dispositivo. */
function comparePageNames(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    const ca = left[i]!;
    const cb = right[j]!;
    if (ca >= '0' && ca <= '9' && cb >= '0' && cb <= '9') {
      let endA = i;
      let endB = j;
      while (endA < left.length && left[endA]! >= '0' && left[endA]! <= '9') endA += 1;
      while (endB < right.length && right[endB]! >= '0' && right[endB]! <= '9') endB += 1;
      const digitsA = left.slice(i, endA).replace(/^0+/, '') || '0';
      const digitsB = right.slice(j, endB).replace(/^0+/, '') || '0';
      if (digitsA.length !== digitsB.length) return digitsA.length - digitsB.length;
      if (digitsA !== digitsB) return digitsA < digitsB ? -1 : 1;
      if (endA - i !== endB - j) return endA - i - (endB - j);
      i = endA;
      j = endB;
      continue;
    }
    if (ca !== cb) return ca < cb ? -1 : 1;
    i += 1;
    j += 1;
  }

  if (left.length !== right.length) return left.length - right.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function parseCbz(
  request: ParseRequest,
  onProgress: (progress: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress({ stage: 'parsing', percent: 10 });
  assertZipSafety(request.bytes);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(request.bytes);
  } catch {
    throw new ParseError('No se pudo abrir el CBZ; puede estar dañado.', 'INVALID_FORMAT');
  }

  const pages = Object.values(zip.files)
    .filter((file) => !file.dir && IMAGE_EXTENSION.test(file.name))
    .sort((a, b) => comparePageNames(a.name, b.name));
  if (pages.length === 0) {
    throw new ParseError('El CBZ no contiene imágenes legibles.', 'INVALID_FORMAT');
  }

  const assets: ParseResult['assets'] = [];
  const nextBlockId = makeBlockIdFactory();
  const blocks: ParseResult['chapters'][number]['blocks'] = [];
  let coverAssetId: string | undefined;
  let totalPixels = 0;

  for (const [index, page] of pages.entries()) {
    onProgress({
      stage: 'extracting-assets',
      percent: 10 + Math.round(((index + 1) / pages.length) * 80),
      message: `Página ${index + 1} de ${pages.length}`,
    });
    const bytes = new Uint8Array(await page.async('uint8array'));
    const size = readImageSize(bytes);
    if (!size) {
      throw new ParseError(`No se pudo leer el tamaño de ${page.name}.`, 'INVALID_FORMAT');
    }
    const pixels = size.width * size.height;
    if (pixels > MAX_IMAGE_PIXELS) {
      throw new ParseError(`La página ${page.name} es demasiado grande.`, 'UNKNOWN');
    }
    totalPixels += pixels;
    if (totalPixels > MAX_TOTAL_PIXELS) {
      throw new ParseError('El CBZ tiene demasiadas páginas de alto detalle.', 'UNKNOWN');
    }

    const id = newId('asset');
    assets.push({
      id,
      kind: index === 0 ? 'cover' : 'image',
      mimeType: guessMimeType(page.name),
      bytes,
      width: size.width,
      height: size.height,
    });
    if (index === 0) coverAssetId = id;
    blocks.push({
      id: nextBlockId(),
      type: 'image',
      assetId: id,
      alt: page.name,
      caption: `Página ${index + 1}`,
    });
  }

  onProgress({ stage: 'normalizing', percent: 95 });
  const title = request.fileName.replace(/\.cbz$/i, '').replace(/[-_]+/g, ' ');
  return {
    contentHash: request.contentHash,
    title,
    author: '',
    fileName: request.fileName,
    fileSize: request.fileSize,
    mimeType: request.mimeType,
    coverAssetId,
    chapters: [{ index: 0, title, blocks }],
    assets,
    totalWordCount: 0,
  };
}
