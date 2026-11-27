import type { SyncProvider } from './provider';

declare const __GOOGLE_DRIVE_CLIENT_ID__: string;

/** Se inyecta desde VITE_GOOGLE_DRIVE_CLIENT_ID; hoy solo prepara la integración. */
export const GOOGLE_DRIVE_CLIENT_ID = __GOOGLE_DRIVE_CLIENT_ID__;

/**
 * Google Drive es el único proveedor cloud previsto, pero sigue desactivado hasta
 * que exista una pantalla de consentimiento y un Client ID validados.
 */
export function isGoogleDriveReady(): boolean {
  return false;
}

export function createGoogleDriveProvider(): SyncProvider {
  if (!isGoogleDriveReady()) {
    throw new Error(
      'Google Drive estará disponible cuando se configure su Client ID de OAuth. Usa la carpeta local mientras tanto.',
    );
  }
  throw new Error('Proveedor Google Drive no inicializado');
}
