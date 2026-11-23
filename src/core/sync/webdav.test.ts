import { describe, expect, it } from 'vitest';
import { createWebDavProvider, type WebDavOptions } from './webdav';

const BASE = 'https://dav.example.com/LeetoSync/';

function mockFetch(handler: (url: string, init: RequestInit) => Response): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}) =>
    handler(String(input), init)) as typeof fetch;
}

function jsonResponse(text: string, etag = '"abc"', status = 200): Response {
  return new Response(text, { status, headers: etag ? { etag } : {} });
}

function provider(opts: Partial<WebDavOptions> & { fetchFn: typeof fetch }) {
  return createWebDavProvider({ baseUrl: BASE, ...opts });
}

describe('provider WebDAV', () => {
  it('lee el sobre y devuelve null si no existe', async () => {
    const calls: string[] = [];
    const sync = provider({
      fetchFn: mockFetch((url, init) => {
        calls.push(`${init.method} ${url}`);
        return url.endsWith('missing.json')
          ? new Response(null, { status: 404 })
          : jsonResponse('{"schemaVersion":1}');
      }),
    });

    expect(await sync.read('leeto_sync.json')).toEqual({ text: '{"schemaVersion":1}', etag: '"abc"' });
    expect(await sync.read('missing.json')).toEqual({ text: null });
    expect(calls).toEqual([
      `GET ${BASE}leeto_sync.json`,
      `GET ${BASE}missing.json`,
    ]);
  });

  it('escribe de forma atómica: PUT temporal + MOVE condicionado al destino', async () => {
    const calls: Array<{ method: string; url: string; init: RequestInit }> = [];
    const sync = provider({
      fetchFn: mockFetch((url, init) => {
        calls.push({ method: init.method ?? '', url, init });
        return new Response(null, {
          status: 201,
          headers: { etag: '"new"' },
        });
      }),
    });

    const result = await sync.write('leeto_sync.json', '{"ok":true}', { etag: '"old"' });
    expect(result.etag).toBe('"new"');
    expect(calls.map((call) => call.method)).toEqual(['PUT', 'MOVE']);
    expect(calls[0]?.url).toBe(`${BASE}leeto_sync.json.tmp`);
    expect(calls[0]?.init.body).toBe('{"ok":true}');
    expect(calls[1]?.init.headers).toMatchObject({
      Destination: `${BASE}leeto_sync.json`,
      Overwrite: 'T',
      If: `<${BASE}leeto_sync.json> ["old"]`,
    });
  });

  it('hace fallback a PUT directo con verificación si el servidor no soporta MOVE', async () => {
    let verified = '{"ok":true}';
    const methods: string[] = [];
    const sync = provider({
      fetchFn: mockFetch((_url, init) => {
        const method = init.method ?? '';
        methods.push(method);
        if (method === 'MOVE') return new Response(null, { status: 405 });
        if (method === 'GET') return jsonResponse(verified);
        return new Response(null, { status: 204 });
      }),
    });

    expect((await sync.write('leeto_sync.json', '{"ok":true}')).etag).toBe('"abc"');
    expect(methods).toEqual(['PUT', 'MOVE', 'PUT', 'GET']);

    verified = '{"otro":true}';
    await expect(sync.write('leeto_sync.json', '{"ok":true}')).rejects.toThrow(/verificación/);
  });

  it('detecta existencia con HEAD y cae a GET si no hay soporte', async () => {
    const sync = provider({
      fetchFn: mockFetch((_url, init) => {
        if (init.method === 'HEAD') return new Response(null, { status: 405 });
        return jsonResponse('contenido');
      }),
    });
    expect(await sync.exists('leeto_sync.json')).toBe(true);

    const missing = provider({
      fetchFn: mockFetch(() => new Response(null, { status: 404 })),
    });
    expect(await missing.exists('leeto_sync.json')).toBe(false);
  });

  it('rechaza HTTP remoto pero permite localhost para desarrollo', () => {
    expect(
      () => createWebDavProvider({ baseUrl: 'http://dav.example.com/LeetoSync', fetchFn: mockFetch(() => new Response()) }),
    ).toThrow(/HTTPS/);
    expect(
      createWebDavProvider({
        baseUrl: 'http://localhost:8080/LeetoSync',
        fetchFn: mockFetch(() => new Response()),
      }).id,
    ).toBe('webdav');
  });

  it('convierte fallos de red en errores accionables sin lanzar detalles crudos', async () => {
    const sync = provider({
      fetchFn: (async () => {
        throw new Error('ECONNRESET');
      }) as typeof fetch,
    });
    await expect(sync.read('leeto_sync.json')).rejects.toThrow(/No se pudo contactar con WebDAV/);
  });

  it('envía autenticación básica cuando se configuran credenciales', async () => {
    let authorization = '';
    const sync = provider({
      username: 'user',
      password: 'pass',
      fetchFn: mockFetch((_url, init) => {
        authorization = String((init.headers as Record<string, string>).Authorization ?? '');
        return jsonResponse('ok');
      }),
    });
    await sync.read('leeto_sync.json');
    expect(authorization).toBe(`Basic ${btoa('user:pass')}`);
  });

  it('codifica contraseñas con caracteres fuera de Latin-1', async () => {
    let authorization = '';
    const sync = provider({
      username: 'uso',
      password: 'clave😀',
      fetchFn: mockFetch((_url, init) => {
        authorization = String((init.headers as Record<string, string>).Authorization ?? '');
        return jsonResponse('ok');
      }),
    });
    await sync.read('leeto_sync.json');

    expect(authorization).toBe(`Basic ${btoa(new TextEncoder().encode('uso:clave😀').reduce((text, byte) => text + String.fromCharCode(byte), ''))}`);
  });

  it('no reintenta con PUT si el destino cambió (412)', async () => {
    const methods: string[] = [];
    const sync = provider({
      fetchFn: mockFetch((_url, init) => {
        methods.push(init.method ?? '');
        return init.method === 'MOVE'
          ? new Response(null, { status: 412, statusText: 'Precondition Failed' })
          : new Response(null, { status: 201 });
      }),
    });

    await expect(
      sync.write('leeto_sync.json', '{"ok":true}', { etag: '"old"' }),
    ).rejects.toThrow(/cambió/i);
    expect(methods).toEqual(['PUT', 'MOVE']);
  });
});
