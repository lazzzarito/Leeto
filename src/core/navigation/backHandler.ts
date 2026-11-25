interface BackHandlerEntry {
  handler: () => boolean;
  priority: number;
}

const handlers = new Set<BackHandlerEntry>();

declare global {
  interface Window {
    leetoHandleBack?: () => boolean;
  }
}

/**
 * Registra un handler de back con prioridad. Los diálogos (prioridad alta) se
 * cierran antes de navegar; la ruta (prioridad baja) decide si vuelve a la
 * biblioteca o si el sistema debe salir de la app.
 */
export function registerBackHandler(handler: () => boolean, priority = 0) {
  const entry: BackHandlerEntry = { handler, priority };
  handlers.add(entry);
  return () => {
    handlers.delete(entry);
  };
}

/** Llamado desde Android a través de `window.leetoHandleBack()`. */
export function handleAppBack(): boolean {
  const ordered = [...handlers].sort((a, b) => b.priority - a.priority);
  for (const { handler } of ordered) {
    try {
      if (handler()) return true;
    } catch {
      // Un handler roto no debe impedir que los demás respondan al back.
    }
  }
  return false;
}
