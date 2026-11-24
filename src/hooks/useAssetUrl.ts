import { useEffect, useState } from 'react';
import { assetsRepo } from '@/core/db/repositories';

/** Crea una object URL para un asset y la revoca al desmontar (D7). */
export function useAssetUrl(assetId?: string): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    // Evita mostrar la imagen del libro anterior mientras carga la nueva.
    setUrl(undefined);
    if (!assetId) return;

    let cancelled = false;
    let objectUrl: string | undefined;

    void assetsRepo.get(assetId).then((asset) => {
      if (!asset || cancelled) return;
      objectUrl = URL.createObjectURL(asset.blob);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  return url;
}
