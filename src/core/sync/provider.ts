/** Proveedores activos: WebDAV y OneDrive quedan fuera de esta versión. */
export type SyncProviderId = 'local-folder' | 'gdrive';

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
  /** Los proveedores con soporte binario sincronizan también los archivos de la biblioteca. */
  readBlob?(name: string): Promise<Blob | null>;
  writeBlob?(name: string, blob: Blob): Promise<void>;
  /** Nombre legible del destino, para mensajes de estado. */
  readonly label: string;
}
