import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Vuelve a la biblioteca conservando el historial real del WebView.
 * Así el gesto «atrás» de Android y el botón del lector hacen lo mismo.
 */
export function useBackToLibrary() {
  const navigate = useNavigate();
  const { key } = useLocation();

  return useCallback(() => {
    // `default` es la entrada inicial: no hay biblioteca previa a la que volver.
    if (key !== 'default') navigate(-1);
    else navigate('/', { replace: true });
  }, [key, navigate]);
}
