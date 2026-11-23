import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/kinetic.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('No se encontró el elemento #root');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Solo en producción: en dev el SW cachearía módulos calientes y rompería HMR.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // La app sigue funcionando online; el SW es una mejora progresiva.
    });
  });
}
