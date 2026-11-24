import { Download, X } from 'lucide-react';
import { useState } from 'react';
import { APK_FILENAME, APK_GITHUB_URL, APK_URL, APP_LABEL, IS_BETA } from '@/lib/buildInfo';
import { isAndroidWeb } from '@/lib/platform';

const DISMISS_KEY = `leeto:apk-notice:${APP_LABEL}`;

function alreadyDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Aviso cerrable en la web de Android para instalar la app. */
export default function ApkDownloadNotice() {
  const [dismissed, setDismissed] = useState(alreadyDismissed);

  if (!isAndroidWeb() || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Sin almacenamiento el aviso solo se cierra para esta sesión.
    }
    setDismissed(true);
  };

  return (
    <aside
      aria-label="Instalar Leeto en Android"
      className="border-border bg-card/95 fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl border p-3 shadow-xl backdrop-blur"
    >
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Download className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Lleva Leeto contigo</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          Instala la app de Android {APP_LABEL} y escucha tus libros en segundo plano.
        </p>
        <p className="text-muted-foreground mt-1 text-[11px]">{APK_FILENAME}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
          <a
            href={APK_URL}
            download={APK_FILENAME}
            className="text-primary inline-flex items-center gap-1.5 underline underline-offset-4"
          >
            <Download className="size-3" aria-hidden="true" />
            Descargar APK{IS_BETA ? ' beta' : ''}
          </a>
          <a
            href={APK_GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1.5 underline underline-offset-4"
          >
            Descargar desde GitHub
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar aviso de descarga"
        className="text-muted-foreground hover:bg-muted flex size-7 shrink-0 items-center justify-center rounded-full"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
