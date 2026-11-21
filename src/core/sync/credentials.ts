const PASSWORD_KEY = 'leeto.webdav.password';

/** La contraseña WebDAV vive solo en la sesión; el resto de la configuración va a Dexie. */
export function saveWebDavPassword(password: string): void {
  try {
    sessionStorage.setItem(PASSWORD_KEY, password);
  } catch {
    // Sin sessionStorage: la contraseña se usa solo en memoria durante esta sesión.
  }
}

export function getWebDavPassword(): string {
  try {
    return sessionStorage.getItem(PASSWORD_KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearWebDavPassword(): void {
  try {
    sessionStorage.removeItem(PASSWORD_KEY);
  } catch {
    // Nada que limpiar.
  }
}
