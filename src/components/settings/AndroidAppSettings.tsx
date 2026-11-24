import { Download, ExternalLink } from 'lucide-react';
import { APK_FILENAME, APK_RELEASES_URL, APK_URL, APP_LABEL } from '@/lib/buildInfo';
import { isAndroidWeb } from '@/lib/platform';

/** Opción de instalación solo en la web de Android. */
export default function AndroidAppSettings() {
  if (!isAndroidWeb()) return null;

  return (
    <section
      aria-labelledby="settings-android-heading"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div>
        <h2 id="settings-android-heading" className="text-base font-medium">
          App de Android
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Versión {APP_LABEL}. Descarga el APK e instálalo para leer y escuchar sin conexión.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{APK_FILENAME}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={APK_URL}
          target="_blank"
          rel="noreferrer"
          className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium"
        >
          <Download className="size-4" aria-hidden="true" />
          Descargar {APK_FILENAME}
        </a>
        <a
          href={APK_RELEASES_URL}
          target="_blank"
          rel="noreferrer"
          className="border-border hover:bg-muted inline-flex h-10 items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Ver release en GitHub
        </a>
      </div>
      <p className="text-muted-foreground text-xs">
        La descarga apunta al release oficial de GitHub; el nombre incluye la versión y el canal.
      </p>
    </section>
  );
}
