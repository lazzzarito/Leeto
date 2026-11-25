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
  const { paletteReady } = useTheme();
  const settingsReady = useSettingsLoaded();
  const { onboardingCompleted } = useSettings();
  const [timedOut, setTimedOut] = useState(false);
  // La portada permanece hasta que la paleta Material You está resuelta: así
  // nunca se ve el tema estático y después el dinámico.
  const ready = (settingsReady && paletteReady) || timedOut;
  const routeRestoredRef = useRef(false);
  const splashTimerRef = useRef<number | undefined>(undefined);

  const hideSplash = useCallback(() => {
    const splash = document.getElementById('boot-splash');
    if (!splash || splash.dataset.hiding === 'true') return;
    splash.dataset.hiding = 'true';
    splash.style.transition = 'opacity 220ms ease-out';
    splash.style.opacity = '0';
    splashTimerRef.current = window.setTimeout(() => splash.remove(), 240);
  }, []);

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

  // Si IndexedDB o el puente nativo no responden, la app sigue abriéndose.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimedOut(true);
      hideSplash();
    }, MAX_SPLASH_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(splashTimerRef.current);
    };
  }, [hideSplash]);

  // La portada inline se desvanece en el mismo commit en que React ya tiene contenido.
  useLayoutEffect(() => {
    if (ready) hideSplash();
  }, [ready, hideSplash]);

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
