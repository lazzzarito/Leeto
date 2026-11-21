import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ensureSettings } from '@/core/db/settings';
import { useTheme } from '@/hooks/useTheme';
import { router } from '@/router';

export default function App() {
  useTheme();

  useEffect(() => {
    void ensureSettings();
  }, []);

  return <RouterProvider router={router} />;
}
