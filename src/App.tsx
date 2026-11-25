import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ImportProvider } from '@/components/import/ImportProvider';
import Onboarding from '@/components/onboarding/Onboarding';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import { ensureSettings, updateSettings, useSettings, useSettingsLoaded } from '@/core/db/settings';
import { useTheme } from '@/hooks/useTheme';
import { handleAppBack } from '@/core/navigation/backHandler';
import { router } from '@/router';

const MAX_SPLASH_MS = 2500;

export default function App() {
  useTheme();
  const settingsReady = useSettingsLoaded();
  const { onboardingCompleted } = useSettings();
  const [timedOut, setTimedOut] = useState(false);
  const ready = settingsReady || timedOut;
  const routeRestoredRef = useRef(false);

  useEffect(() => {
    void ensureSettings();
  }, []);

  // Android delega el back a esta función; el mismo handler sirve al botón
  // del lector y a la tecla Escape.
  useEffect(() => {
    window.leetoHandleBack = handleAppBack;
    return () => {
      delete window.leetoHandleBack;
    };
  }, []);

  // Tras matar el proceso, el WebView vuelve a '/'. Recuperamos la lectura
  // anterior; el progreso ya sobrevive en IndexedDB.
  useEffect(() => {
    if (!ready || routeRestoredRef.current) return;
    routeRestoredRef.current = true;
    try {
      const last = window.localStorage.getItem('leeto:lastRoute');
      if (last && last.startsWith('/read/') && router.state.location.pathname === '/') {
        void router.navigate(last, { replace: true });
      }
    } catch {
      // localStorage puede estar deshabilitado; la app sigue funcionando.
    }
  }, [ready]);

  // Si IndexedDB no está disponible, la app sigue abriéndose.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimedOut(true);
      document.getElementById('boot-splash')?.remove();
    }, MAX_SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // La portada inline se retira en el mismo commit en que React ya tiene contenido.
  useLayoutEffect(() => {
    if (ready) document.getElementById('boot-splash')?.remove();
  }, [ready]);

  const finishOnboarding = useCallback(() => {
    void updateSettings({ onboardingCompleted: true });
  }, []);

  return (
    <NotificationProvider>
      <ImportProvider>
        {ready && !onboardingCompleted && <Onboarding onFinish={finishOnboarding} />}
        <RouterProvider router={router} />
      </ImportProvider>
    </NotificationProvider>
  );
}
