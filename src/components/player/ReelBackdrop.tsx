import { useAssetUrl } from '@/hooks/useAssetUrl';
import { cn } from '@/lib/cn';

interface ReelBackdropProps {
  coverAssetId?: string;
  animate: boolean;
}

/** Portada desenfocada a pantalla completa, con velo oscuro para que el subtítulo mande. */
export default function ReelBackdrop({ coverAssetId, animate }: ReelBackdropProps) {
  const coverUrl = useAssetUrl(coverAssetId);
  if (!coverUrl) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <img
        src={coverUrl}
        alt=""
        className={cn(
          'absolute -inset-[10%] size-[120%] object-cover opacity-70 blur-md saturate-75',
          animate && 'reel-backdrop-drift',
        )}
      />
      <div className="reel-backdrop-tint absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/70" />
    </div>
  );
}
