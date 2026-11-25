import { useEffect, useState } from 'react';
import { assetsRepo } from '@/core/db/repositories';

const MAX_COVER_PX = 256;
const MAX_DATA_URL_CHARS = 300_000;

/**
 * `undefined` = aún no hay contexto de libro (no tocar la portada nativa).
 * `null` = el libro existe pero no tiene portada usable (sí hay que limpiarla).
 */
export type CoverDataUrl = string | null | undefined;

async function encodeCover(blob: Blob): Promise<string | undefined> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return undefined;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, MAX_COVER_PX / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // Un data URL directo puede superar el límite del puente nativo; 256 px y
    // JPEG comprimido mantienen el payload pequeño en cualquier dispositivo.
    let dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (dataUrl.length > MAX_DATA_URL_CHARS) dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    return dataUrl.length <= MAX_DATA_URL_CHARS ? dataUrl : undefined;
  } catch {
    return undefined;
  } finally {
    bitmap?.close();
  }
}

/** Portada reducida para el servicio nativo: un `blob:` del WebView no sirve fuera de él. */
export function useCoverDataUrl(assetId?: string | null): CoverDataUrl {
  const [dataUrl, setDataUrl] = useState<CoverDataUrl>();

  useEffect(() => {
    if (assetId === undefined) {
      setDataUrl(undefined);
      return;
    }
    if (!assetId) {
      setDataUrl(null);
      return;
    }

    let cancelled = false;
    void assetsRepo
      .get(assetId)
      .then((asset) => (asset ? encodeCover(asset.blob) : undefined))
      .then((encoded) => {
        if (!cancelled) setDataUrl(encoded ?? null);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return dataUrl;
}
