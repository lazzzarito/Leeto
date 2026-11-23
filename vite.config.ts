import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

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
  plugins: [serviceWorkerPrecache(), react()],
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
