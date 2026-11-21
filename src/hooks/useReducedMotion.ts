import { useEffect, useState } from 'react';
import type { AppSettings } from '@/types';

type MotionPreference = AppSettings['reducedMotion'];

/** Respeta el sistema salvo override explícito en ajustes. */
export function useReducedMotion(preference: MotionPreference): boolean {
  const [systemReduced, setSystemReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (preference === 'on') return true;
  if (preference === 'off') return false;
  return systemReduced;
}
