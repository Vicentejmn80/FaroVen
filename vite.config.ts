import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Lee version.json generado por prebuild — fuente única de verdad para el bundle. */
function loadReleaseMeta() {
  try {
    const raw = readFileSync(path.resolve(__dirname, 'public/version.json'), 'utf8')
    const parsed = JSON.parse(raw) as {
      version: string
      buildDate: string
      commit?: string
    }
    return {
      releaseCode: parsed.version,
      buildDate: parsed.buildDate,
      buildCommit: parsed.commit ?? getLocalCommit(),
    }
  } catch {
    const buildDate = new Date().toISOString()
    return {
      releaseCode: formatReleaseCode(),
      buildDate,
      buildCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? getLocalCommit(),
    }
  }
}

const { releaseCode, buildDate, buildCommit } = loadReleaseMeta()

function formatReleaseCode(): string {
  const now = new Date()
  const y = String(now.getFullYear()).slice(2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  let seq = '001'
  try {
    seq = String(Number(execSync('git rev-list --count HEAD').toString().trim())).padStart(3, '0')
  } catch {
    // noop
  }
  return `FARO-${y}${m}${d}-${seq}`
}

function getLocalCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}


export default defineConfig({
  define: {
    __FARO_BUILD_DATE__: JSON.stringify(buildDate),
    __FARO_BUILD_COMMIT__: JSON.stringify(buildCommit),
    __FARO_RELEASE_CODE__: JSON.stringify(releaseCode),
  },
  plugins: [
    react(),
    VitePWA({
      /**
       * 'prompt': el nuevo SW espera en estado "waiting" hasta que el usuario confirma.
       * Evita recargas inesperadas mientras el usuario interactúa con la app.
       */
      injectRegister: 'auto',
      registerType: 'prompt',
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'FARO',
        short_name: 'FARO',
        description: 'Centro de operaciones humanitario. Información verificada en tiempo real.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#003399',
        theme_color: '#003399',
        lang: 'es',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-monochrome-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'monochrome',
          },
          {
            src: '/icons/icon-monochrome-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'monochrome',
          },
          {
            src: '/icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-192.png',
        'icons/icon-maskable-512.png',
        'icons/icon-monochrome-192.png',
        'icons/icon-monochrome-512.png',
        'icons/apple-touch-icon.png',
        'icons/favicon-32.png',
        'icons/favicon-48.png',
      ],
      workbox: {
        cleanupOutdatedCaches: true,
        // skipWaiting: false (por defecto con 'prompt') — el usuario decide cuándo activar
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,png,webp,svg}'],
        // version.json NUNCA debe cachearse — siempre debe ir a la red
        navigateFallbackDenylist: [/version\.json/],
        runtimeCaching: [
          {
            urlPattern: /\/version\.json$/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /^https:\/\/.*supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nominatim/, ''),
      },
    },
  },
})
