import { ImageOff } from 'lucide-react';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { cn } from '@/lib/cn';

interface ImageBlockProps {
  assetId: string;
  alt?: string;
  caption?: string;
  kenBurns: boolean;
}

export default function ImageBlock({ assetId, alt, caption, kenBurns }: ImageBlockProps) {
  const url = useAssetUrl(assetId);

  return (
    <figure className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-3">
      {url ? (
        <img
          src={url}
          alt={alt ?? ''}
          className={cn(
            'max-h-[65dvh] max-w-full rounded-lg object-contain shadow-sm',
            kenBurns && 'leeto-ken-burns',
          )}
        />
      ) : (
        <div className="bg-muted flex aspect-video w-full items-center justify-center rounded-xl">
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            <ImageOff className="size-4" aria-hidden="true" />
            Imagen no disponible
          </span>
        </div>
      )}
      {caption && (
        <figcaption className="text-muted-foreground text-center text-sm">{caption}</figcaption>
      )}
    </figure>
  );
}
