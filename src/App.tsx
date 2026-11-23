import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import Onboarding from '@/components/onboarding/Onboarding';
import { ensureSettings, updateSettings, useSettings, useSettingsLoaded } from '@/core/db/settings';
import { useTheme } from '@/hooks/useTheme';
import { router } from '@/router';

const MAX_SPLASH_MS = 2500;

export default function App() {
  useTheme();
  const settingsReady = useSettingsLoaded();
  const { onboardingCompleted } = useSettings();
  const [timedOut, setTimedOut] = useState(false);
  const ready = settingsReady || timedOut;

  useEffect(() => {
    void ensureSettings();
  }, []);

  // Si IndexedDB no está disponible, la app sigue abriéndose.
  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), MAX_SPLASH_MS);
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
    <>
      {ready && !onboardingCompleted && <Onboarding onFinish={finishOnboarding} />}
      <RouterProvider router={router} />
    </>
  );
}
