export type SyncProviderId = 'webdav' | 'local-folder';

export interface SyncReadResult {
  text: string | null;
  etag?: string;
}

export interface SyncWriteOptions {
  /** Conditional write: fail if the remote changed since it was read. */
  etag?: string;
}

export interface SyncWriteResult {
  etag?: string;
}

export interface SyncProvider {
  readonly id: SyncProviderId;
  read(name: string): Promise<SyncReadResult>;
  write(name: string, text: string, options?: SyncWriteOptions): Promise<SyncWriteResult>;
  exists(name: string): Promise<boolean>;
  /** Copia el archivo remoto a un backup antes de sobrescribirlo (best-effort). */
  backupRemote?(name: string, backupName: string): Promise<void>;
  /** Nombre legible del destino, para mensajes de estado. */
  readonly label: string;
}

/** WebDAV con credenciales exige HTTPS salvo en localhost (desarrollo/NAS local). */
export function isSecureSyncUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'https:') return true;
    if (url.protocol !== 'http:') return false;
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function resolveRemoteUrl(baseUrl: string, name: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${name.replace(/^\/+/, '')}`;
}
