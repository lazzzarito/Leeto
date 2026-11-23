import { useCallback, useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import Onboarding from '@/components/onboarding/Onboarding';
import Preloader from '@/components/ui/Preloader';
import { ensureSettings, updateSettings, useSettings, useSettingsLoaded } from '@/core/db/settings';
import { useTheme } from '@/hooks/useTheme';
import { router } from '@/router';

const MAX_SPLASH_MS = 2500;

export default function App() {
  useTheme();
  const settingsReady = useSettingsLoaded();
  const { onboardingCompleted } = useSettings();
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    void ensureSettings();
  }, []);

  useEffect(() => {
    if (settingsReady) setBooted(true);
  }, [settingsReady]);

  // Si IndexedDB no está disponible, la app sigue abriéndose.
  useEffect(() => {
    const timer = window.setTimeout(() => setBooted(true), MAX_SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const finishOnboarding = useCallback((name: string) => {
    void updateSettings({ userName: name, onboardingCompleted: true });
  }, []);

  return (
    <>
      <Preloader visible={!booted} />
      {booted && !onboardingCompleted && <Onboarding onFinish={finishOnboarding} />}
      <RouterProvider router={router} />
    </>
  );
}
