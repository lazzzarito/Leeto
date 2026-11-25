import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Vuelve a la biblioteca conservando el historial real del WebView.
 * Así el gesto «atrás» de Android y el botón del lector hacen lo mismo.
 */
export function useBackToLibrary() {
  const navigate = useNavigate();
  const { key } = useLocation();
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(() => {
    // Un doble toque no debe consumir dos entradas del historial.
    if (busyRef.current) return;
    busyRef.current = true;
    timerRef.current = setTimeout(() => {
      busyRef.current = false;
      timerRef.current = undefined;
    }, 300);

    // `default` es la entrada inicial: no hay biblioteca previa a la que volver.
    if (key !== 'default') navigate(-1);
    else navigate('/', { replace: true });
  }, [key, navigate]);
}
