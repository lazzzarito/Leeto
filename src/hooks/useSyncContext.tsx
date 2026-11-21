import { createContext, useContext, type ReactNode } from 'react';
import { useSync } from './useSync';

type SyncController = ReturnType<typeof useSync>;

const SyncContext = createContext<SyncController | null>(null);

/** Un único planificador de sync montado durante toda la sesión de la app. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const controller = useSync();
  return <SyncContext.Provider value={controller}>{children}</SyncContext.Provider>;
}

export function useSyncController(): SyncController {
  const controller = useContext(SyncContext);
  if (!controller) throw new Error('useSyncController debe usarse dentro de SyncProvider');
  return controller;
}
