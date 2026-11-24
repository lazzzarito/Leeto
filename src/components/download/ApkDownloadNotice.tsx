import { useEffect, useRef } from 'react';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { APK_FILENAME, APK_RELEASES_URL, APK_URL, APP_LABEL, IS_BETA } from '@/lib/buildInfo';
import { isAndroidWeb } from '@/lib/platform';

const DISMISS_KEY = `leeto:apk-notice:${APP_LABEL}`;

function alreadyDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Aviso de descarga de APK integrado en el sistema de notificaciones. */
export default function ApkDownloadNotice() {
  const { push, dismiss } = useNotifications();
  const noticeIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isAndroidWeb() || alreadyDismissed()) return;
    if (noticeIdRef.current) return;

    const id = push({
      kind: 'info',
      title: 'Lleva Leeto contigo',
      subtitle: `Instala la app de Android ${APP_LABEL} y escucha tus libros en segundo plano. ${APK_FILENAME}`,
      dismissible: true,
      onDismiss: () => {
        try {
          localStorage.setItem(DISMISS_KEY, '1');
        } catch {
          // Sin almacenamiento el aviso solo se cierra para esta sesión.
        }
        noticeIdRef.current = undefined;
      },
      actions: [
        {
          label: `Descargar APK${IS_BETA ? ' beta' : ''}`,
          href: APK_URL,
          external: true,
        },
        { label: 'GitHub', href: APK_RELEASES_URL, external: true, variant: 'secondary' },
        {
          label: 'Cerrar',
          variant: 'secondary',
          onClick: () => {
            try {
              localStorage.setItem(DISMISS_KEY, '1');
            } catch {
              // Sin almacenamiento el aviso solo se cierra para esta sesión.
            }
            if (noticeIdRef.current) dismiss(noticeIdRef.current);
          },
        },
      ],
    });
    noticeIdRef.current = id;
  }, [dismiss, push]);

  return null;
}
