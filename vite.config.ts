import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const SITE_URL = 'https://leeto.vercel.app/';

/** URL pública de producción; se puede sobreescribir con VITE_SITE_URL. */
function publicSiteUrl(raw?: string): string {
  const value = raw?.trim() || SITE_URL;
  try {
    return new URL(value).href.replace(/\/?$/, '/');
  } catch {
    return SITE_URL;
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return entities[character];
  });
}

/** Metadatos de compartir, canonical y robots para el dominio de producción. */
function siteMetadata(site: string) {
  return {
    name: 'leeto-site-metadata',
    apply: 'build' as const,
    transformIndexHtml() {
      const image = `${site}og-image.png`;
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: site }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { property: 'og:url', content: site }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { property: 'og:image', content: image }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { name: 'twitter:title', content: 'Leeto — lector de libros' }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { name: 'twitter:description', content: 'Importa EPUB, PDF, cómics y texto, lee sin conexión y guarda tus citas en este dispositivo.' }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { name: 'twitter:image', content: image }, injectTo: 'head' as const },
      ];
    },
    closeBundle() {
      const outDir = join(rootDir, 'dist');
      writeFileSync(
        join(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${escapeXml(site)}</loc></url>\n</urlset>\n`,
      );
      writeFileSync(
        join(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`,
      );
    },
  };
}

function serviceWorkerPrecache() {
  return {
    name: 'leeto-sw-precache',
    apply: 'build' as const,
    closeBundle() {
      const outDir = join(rootDir, 'dist');
      const swPath = join(outDir, 'sw.js');
      if (!existsSync(swPath)) return;

      const assetsDir = join(outDir, 'assets');
      const assets = existsSync(assetsDir)
        ? readdirSync(assetsDir)
            .filter((name) => /\.(js|mjs|css)$/.test(name))
            .map((name) => `/assets/${name}`)
        : [];
      const precache = [
        '/index.html',
        ...assets,
        '/manifest.webmanifest',
        '/doodles.svg',
        '/icons/icon.png',
        '/icons/icon-monochrome.png',
        '/icons/icon-192.png',
        '/icons/icon-192.webp',
        '/icons/icon-512.png',
        '/icons/icon-512.webp',
        '/icons/icon-maskable-512.png',
      ].filter((path) => existsSync(join(outDir, path.replace(/^\//, ''))));

      const versionSource = precache
        .map((path) => createHash('sha256').update(readFileSync(join(outDir, path.replace(/^\//, '')))).digest('hex'))
        .join('|');
      const version = createHash('sha256').update(versionSource).digest('hex').slice(0, 10);
      const source = readFileSync(swPath, 'utf8')
        .replace('self.__CACHE_VERSION__', `'${version}'`)
        .replace('self.__PRECACHE__', JSON.stringify(precache));
      writeFileSync(swPath, source);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, 'VITE_');
  const site = publicSiteUrl(process.env.VITE_SITE_URL || env.VITE_SITE_URL);
  const packageVersion = (
    JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as { version: string }
  ).version;
  const channel = (process.env.VITE_BUILD_CHANNEL || env.VITE_BUILD_CHANNEL) === 'stable'
    ? 'stable'
    : 'beta';
  const channelLabel = channel === 'beta' ? 'Beta' : 'Normal';
  const apkFileName = `Leeto-${packageVersion}${channel === 'beta' ? '-beta' : ''}.apk`;

  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageVersion),
      __APP_CHANNEL__: JSON.stringify(channel),
      __APP_LABEL__: JSON.stringify(`v${packageVersion} · ${channelLabel}`),
      __APK_FILENAME__: JSON.stringify(apkFileName),
      __SITE_URL__: JSON.stringify(site),
    },
    plugins: [siteMetadata(site), serviceWorkerPrecache(), react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/@remix-run')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/jszip') || id.includes('node_modules/fast-xml-parser')) {
              return 'epub-vendor';
            }
            if (id.includes('node_modules/dexie')) return 'db-vendor';
            if (id.includes('node_modules/@radix-ui')) return 'ui-vendor';
            if (id.includes('node_modules/lucide-react')) return 'icons';
            return undefined;
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
    worker: {
      format: 'es',
    },
  };
});
