let password = '';

/** La contraseña WebDAV vive solo en memoria: nunca se escribe en sessionStorage. */
export function saveWebDavPassword(value: string): void {
  password = value;
}

export function getWebDavPassword(): string {
  return password;
}

export function clearWebDavPassword(): void {
  password = '';
}
