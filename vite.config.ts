import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/** URL pública opcional. Sin ella se usan rutas relativas y el canonical se calcula en el cliente. */
function publicSiteUrl(): string | undefined {
  const raw = process.env.VITE_SITE_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).href.replace(/\/?$/, '/');
  } catch {
    return undefined;
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

/** Metadatos de compartir y robots: absolutos solo cuando hay dominio configurado. */
function siteMetadata() {
  return {
    name: 'leeto-site-metadata',
    apply: 'build' as const,
    transformIndexHtml() {
      const site = publicSiteUrl();
      const image = site ? `${site}og-image.png` : '/og-image.png';
      return [
        ...(site
          ? [
              { tag: 'link', attrs: { rel: 'canonical', href: site }, injectTo: 'head' as const },
              { tag: 'meta', attrs: { property: 'og:url', content: site }, injectTo: 'head' as const },
            ]
          : []),
        { tag: 'meta', attrs: { property: 'og:image', content: image }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { name: 'twitter:title', content: 'Leeto — tus libros, a tu ritmo' }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { name: 'twitter:description', content: 'Lector local-first: importa EPUB, PDF, cómics y texto, lee sin conexión y guarda tus citas en este dispositivo.' }, injectTo: 'head' as const },
        { tag: 'meta', attrs: { name: 'twitter:image', content: image }, injectTo: 'head' as const },
      ];
    },
    closeBundle() {
      const outDir = join(rootDir, 'dist');
      const site = publicSiteUrl();
      const sitemap = site
        ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${escapeXml(site)}</loc></url>\n</urlset>\n`
        : undefined;
      if (sitemap) writeFileSync(join(outDir, 'sitemap.xml'), sitemap);
      writeFileSync(
        join(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\n${sitemap ? `Sitemap: ${site}sitemap.xml\n` : ''}`,
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
        '/icons/icon.svg',
        '/icons/icon-192.png',
        '/icons/icon-192.webp',
        '/icons/icon-512.png',
        '/icons/icon-512.webp',
        '/icons/icon-maskable-512.png',
      ].filter((path) => existsSync(join(outDir, path.replace(/^\//, ''))));

      const versionSource = precache
        .map((path) => `${path}:${statSync(join(outDir, path.replace(/^\//, ''))).size}`)
        .join('|');
      const version = createHash('sha256').update(versionSource).digest('hex').slice(0, 10);
      const source = readFileSync(swPath, 'utf8')
        .replace('self.__CACHE_VERSION__', `'${version}'`)
        .replace('self.__PRECACHE__', JSON.stringify(precache));
      writeFileSync(swPath, source);
    },
  };
}

export default defineConfig({
  plugins: [siteMetadata(), serviceWorkerPrecache(), react()],
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
});
