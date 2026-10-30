/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Ayarlar'da gösterilen sürüm: GitHub Actions'ta commit, yerelde git'ten
const commit = (process.env.GITHUB_SHA ?? (() => { try { return execSync('git rev-parse HEAD').toString() } catch { return 'dev' } })()).trim().slice(0, 7)

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(commit),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  base: './', // göreli yollar: herhangi bir statik hostta / alt klasörde çalışır (GitHub Pages: /butce-app/)
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate', // yeni sürüm gelince kendiliğinden yüklenir ve sayfa yenilenir (src/pwa.ts)
      injectRegister: false,
      includeAssets: ['favicon-64.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bütçe',
        short_name: 'Bütçe',
        description: 'Kişisel gelir–gider takibi',
        lang: 'tr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fbf5e8',
        theme_color: '#1f7438',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,webmanifest}'],
        // Büyük simgeler sadece kurulumda lazım; internetsiz önbelleğe girmesin
        globIgnores: ['**/pwa-512.png', '**/maskable-512.png'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
