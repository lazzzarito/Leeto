/** Parser de cómics CBZ: páginas de imagen con orden natural y progreso por página. */

import JSZip from 'jszip';
import { newId } from '@/lib/ids';
import { guessMimeType, makeBlockIdFactory } from './normalize';
import { ParseError, type ParseProgress, type ParseRequest, type ParseResult } from './types';
import { assertZipSafety } from './zipSafety';

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

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
    .sort((a, b) => collator.compare(a.name, b.name));
  if (pages.length === 0) {
    throw new ParseError('El CBZ no contiene imágenes legibles.', 'INVALID_FORMAT');
  }

  const assets: ParseResult['assets'] = [];
  const nextBlockId = makeBlockIdFactory();
  const blocks: ParseResult['chapters'][number]['blocks'] = [];
  let coverAssetId: string | undefined;

  for (const [index, page] of pages.entries()) {
    onProgress({
      stage: 'extracting-assets',
      percent: 10 + Math.round(((index + 1) / pages.length) * 80),
      message: `Página ${index + 1} de ${pages.length}`,
    });
    const id = newId('asset');
    assets.push({
      id,
      kind: index === 0 ? 'cover' : 'image',
      mimeType: guessMimeType(page.name),
      bytes: new Uint8Array(await page.async('uint8array')),
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
