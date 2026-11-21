import {
  isSecureSyncUrl,
  resolveRemoteUrl,
  type SyncProvider,
  type SyncReadResult,
  type SyncWriteOptions,
  type SyncWriteResult,
} from './provider';

export interface WebDavOptions {
  baseUrl: string;
  username?: string;
  password?: string;
  /** Inyectable en tests; por defecto fetch global. */
  fetchFn?: typeof fetch;
}

function encodeBasicAuth(username: string, password: string): string {
  const value = typeof btoa === 'function' ? btoa(`${username}:${password}`) : '';
  return `Basic ${value}`;
}

/** Cliente WebDAV mínimo: GET / HEAD / PUT + MOVE atómico con fallback verificado. */
export function createWebDavProvider({
  baseUrl,
  username = '',
  password = '',
  fetchFn = fetch,
}: WebDavOptions): SyncProvider {
  if (!isSecureSyncUrl(baseUrl)) {
    throw new Error('WebDAV requiere HTTPS (o localhost en desarrollo) para proteger las credenciales');
  }

  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (username || password) headers.Authorization = encodeBasicAuth(username, password);

  const urlFor = (name: string) => resolveRemoteUrl(baseUrl, name);

  async function request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchFn(url, { ...init, headers: { ...headers, ...init.headers } });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No se pudo contactar con WebDAV: ${detail}`);
    }
  }

  function assertOk(response: Response, action: string): void {
    if (!response.ok && response.status !== 404 && response.status !== 405) {
      throw new Error(`WebDAV ${action}: HTTP ${response.status} ${response.statusText}`);
    }
  }

  return {
    id: 'webdav',
    label: 'WebDAV',

    async read(name): Promise<SyncReadResult> {
      const response = await request(urlFor(name), { method: 'GET' });
      assertOk(response, 'lectura');
      if (response.status === 404) return { text: null };
      return { text: await response.text(), etag: response.headers.get('etag') ?? undefined };
    },

    async exists(name): Promise<boolean> {
      const response = await request(urlFor(name), { method: 'HEAD' });
      assertOk(response, 'comprobación');
      if (response.ok) return true;
      if (response.status === 404) return false;
      // Algunos servidores no soportan HEAD: caemos a GET.
      return (await this.read(name)).text !== null;
    },

    async backupRemote(name, backupName): Promise<void> {
      const response = await request(urlFor(name), {
        method: 'COPY',
        headers: {
          Destination: urlFor(backupName),
          Overwrite: 'T',
        },
      });
      // 404 (aún no hay archivo) no es un error: no hay nada que respaldar.
      if (!response.ok && response.status !== 404) {
        throw new Error(`WebDAV backup: HTTP ${response.status} ${response.statusText}`);
      }
    },

    async write(name, text, options: SyncWriteOptions = {}): Promise<SyncWriteResult> {
      const target = urlFor(name);
      const temporary = `${target}.tmp`;
      const conditional: Record<string, string> = options.etag ? { 'If-Match': options.etag } : {};

      const staged = await request(temporary, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      assertOk(staged, 'escritura temporal');
      if (!staged.ok) throw new Error(`WebDAV escritura temporal: HTTP ${staged.status}`);

      const moved = await request(temporary, {
        method: 'MOVE',
        headers: { Destination: target, Overwrite: 'T', ...conditional },
      });
      assertOk(moved, 'movimiento atómico');

      if (!moved.ok) {
        // Proveedor sin MOVE: escritura directa + relectura de verificación.
        const direct = await request(target, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...conditional },
          body: text,
        });
        assertOk(direct, 'escritura');
        if (!direct.ok) throw new Error(`WebDAV escritura: HTTP ${direct.status}`);
        const verified = await this.read(name);
        if (verified.text !== text) {
          throw new Error('WebDAV: la verificación posterior a la escritura no coincide');
        }
        return { etag: verified.etag };
      }

      return { etag: moved.headers.get('etag') ?? staged.headers.get('etag') ?? undefined };
    },
  };
}
