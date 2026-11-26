import { useEffect, useState } from 'react';
import { assetsRepo } from '@/core/db/repositories';

interface CachedAssetUrl {
  url?: string;
  refs: number;
  promise?: Promise<string | undefined>;
}

const cache = new Map<string, CachedAssetUrl>();

function retain(assetId: string): CachedAssetUrl {
  let entry = cache.get(assetId);
  if (!entry) {
    entry = { refs: 0 };
    cache.set(assetId, entry);
  }
  entry.refs += 1;
  return entry;
}

function release(assetId: string) {
  const entry = cache.get(assetId);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  if (entry.url) URL.revokeObjectURL(entry.url);
  cache.delete(assetId);
}

function load(assetId: string, entry: CachedAssetUrl): Promise<string | undefined> {
  if (entry.url) return Promise.resolve(entry.url);
  if (entry.promise) return entry.promise;
  entry.promise = assetsRepo.get(assetId).then((asset) => {
    const current = cache.get(assetId);
    if (!current) return undefined;
    if (!asset) {
      current.promise = undefined;
      return undefined;
    }
    // Otro consumidor pudo resolver mientras esperábamos.
    if (current.url) return current.url;
    current.url = URL.createObjectURL(asset.blob);
    current.promise = undefined;
    return current.url;
  });
  return entry.promise;
}

/** Invalida una portada en caché cuando su blob cambia con el mismo assetId. */
export function invalidateAssetUrl(assetId?: string) {
  if (!assetId) return;
  const entry = cache.get(assetId);
  if (!entry) return;
  if (entry.url) URL.revokeObjectURL(entry.url);
  cache.delete(assetId);
}

/**
 * Resuelve un asset a object URL con caché en memoria.
 * Evita el parpadeo al remontar tarjetas al cambiar de pestaña/filtro.
 */
export function useAssetUrl(assetId?: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() =>
    assetId ? cache.get(assetId)?.url : undefined,
  );

  useEffect(() => {
    if (!assetId) {
      setUrl(undefined);
      return;
    }

    const entry = retain(assetId);
    if (entry.url) {
      setUrl(entry.url);
      return () => release(assetId);
    }

    let cancelled = false;
    setUrl(undefined);
    void load(assetId, entry).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });

    return () => {
      cancelled = true;
      release(assetId);
    };
  }, [assetId]);

  return url;
}
