import { Check, GitBranch, Scale, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GITHUB_REPO_URL, SITE_URL } from '@/lib/buildInfo';
import { shareText } from '@/lib/share';

const PILL_CLASS =
  'border-border hover:bg-muted inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors';

/** Accesos legales, código y difusión, siempre arriba del modal de ajustes. */
export default function SettingsQuickActions({
  onNavigate,
}: {
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  const [shareMessage, setShareMessage] = useState<string>();

  const handleShare = async () => {
    const result = await shareText(
      `Leeto: lector de EPUB, PDF y cómics para móvil y web. ${SITE_URL}\nCódigo abierto: ${GITHUB_REPO_URL}`,
      'Leeto',
    );
    setShareMessage(
      result === 'shared'
        ? 'Compartido'
        : result === 'copied'
          ? 'Enlace copiado'
          : result === 'cancelled'
            ? undefined
            : 'No se pudo compartir',
    );
  };

  return (
    <div className="space-y-2">
      <nav aria-label="Accesos rápidos" className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onNavigate();
            navigate('/legal');
          }}
          className={PILL_CLASS}
        >
          <Scale className="size-3.5 shrink-0" aria-hidden="true" />
          Legal
        </button>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className={PILL_CLASS}
        >
          <GitBranch className="size-3.5 shrink-0" aria-hidden="true" />
          GitHub
        </a>
        <button type="button" onClick={() => void handleShare()} className={PILL_CLASS}>
          {shareMessage ? (
            <Check className="text-primary size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Share2 className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          {shareMessage ?? 'Compartir'}
        </button>
      </nav>
      <p aria-live="polite" className="sr-only">
        {shareMessage ?? ''}
      </p>
    </div>
  );
}
