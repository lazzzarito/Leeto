import { ImageOff } from 'lucide-react';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { cn } from '@/lib/cn';

interface ImageBlockProps {
  assetId: string;
  alt?: string;
  caption?: string;
  kenBurns: boolean;
  fill?: boolean;
}

export default function ImageBlock({
  assetId,
  alt,
  caption,
  kenBurns,
  fill = false,
}: ImageBlockProps) {
  const url = useAssetUrl(assetId);

  return (
    <figure className={cn(fill ? 'relative h-full w-full' : 'mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-3')}>
      {url ? (
        <img
          src={url}
          alt={alt ?? ''}
          className={cn(
            fill
              ? 'absolute inset-0 size-full object-cover'
              : 'max-h-[65dvh] max-w-full rounded-lg object-contain shadow-sm',
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
      {fill && <span className="reel-top-scrim pointer-events-none absolute inset-x-0 top-0 h-32" aria-hidden="true" />}
      {caption && !fill && (
        <figcaption className="text-muted-foreground text-center text-sm">{caption}</figcaption>
      )}
    </figure>
  );
}
