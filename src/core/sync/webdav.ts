import { readResponseTextLimited } from './limits';
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
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${typeof btoa === 'function' ? btoa(binary) : binary}`;
}

/** WebDAV condiciona la escritura sobre el destino, no sobre el archivo temporal. */
function ifHeader(url: string, etag?: string): Record<string, string> {
  return etag ? { If: `<${url}> [${etag}]` } : {};
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

  function assertOk(response: Response, action: string, allowed: number[] = []): void {
    if (!response.ok && !allowed.includes(response.status)) {
      throw new Error(`WebDAV ${action}: HTTP ${response.status} ${response.statusText}`);
    }
  }

  function conflict(action: string, response: Response): never {
    throw new Error(
      `WebDAV ${action}: HTTP ${response.status} ${response.statusText}. El archivo remoto cambió; vuelve a sincronizar.`,
    );
  }

  return {
    id: 'webdav',
    label: 'WebDAV',

    async read(name): Promise<SyncReadResult> {
      const response = await request(urlFor(name), { method: 'GET' });
      assertOk(response, 'lectura', [404]);
      if (response.status === 404) return { text: null };
      return { text: await readResponseTextLimited(response), etag: response.headers.get('etag') ?? undefined };
    },

    async exists(name): Promise<boolean> {
      const response = await request(urlFor(name), { method: 'HEAD' });
      assertOk(response, 'comprobación', [404, 405]);
      if (response.ok) return true;
      if (response.status === 404) return false;
      // Algunos servidores no soportan HEAD: caemos a GET.
      return (await this.read(name)).text !== null;
    },

    async backupRemote(name, backupName): Promise<void> {
      const target = urlFor(name);
      const head = await request(target, { method: 'HEAD' });
      const etag = head.ok ? (head.headers.get('etag') ?? undefined) : undefined;
      const response = await request(target, {
        method: 'COPY',
        headers: {
          Destination: urlFor(backupName),
          Overwrite: 'T',
          ...ifHeader(target, etag),
        },
      });
      // 404 (aún no hay archivo) no es un error: no hay nada que respaldar.
      if (!response.ok && response.status !== 404) conflict('backup', response);
    },

    async write(name, text, options: SyncWriteOptions = {}): Promise<SyncWriteResult> {
      const target = urlFor(name);
      const temporary = `${target}.tmp`;
      const conditional = ifHeader(target, options.etag);

      const staged = await request(temporary, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      assertOk(staged, 'escritura temporal');

      const moved = await request(temporary, {
        method: 'MOVE',
        headers: { Destination: target, Overwrite: 'T', ...conditional },
      });
      if (moved.status === 412) conflict('movimiento atómico', moved);
      if (!moved.ok && moved.status !== 405) assertOk(moved, 'movimiento atómico');

      if (!moved.ok) {
        // Proveedor sin MOVE: escritura directa condicionada + relectura de verificación.
        const direct = await request(target, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...conditional },
          body: text,
        });
        if (direct.status === 412) conflict('escritura', direct);
        assertOk(direct, 'escritura');
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
