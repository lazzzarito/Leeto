import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Vuelve a la biblioteca de forma explícita.
 *
 * Usar `navigate(-1)` era frágil: al restaurar la última lectura tras matar el
 * proceso, el historial del WebView podía no tener una entrada nuestra detrás
 * y el «atrás» terminaba cerrando la app.
 */
export function useBackToLibrary() {
  const navigate = useNavigate();
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(() => {
    // Un doble toque no debe consumir dos navegaciones.
    if (busyRef.current) return;
    busyRef.current = true;
    timerRef.current = setTimeout(() => {
      busyRef.current = false;
      timerRef.current = undefined;
    }, 300);

    navigate('/', { replace: true });
  }, [navigate]);
}
