import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import game from './data/game.json' with { type: 'json' };

/** Setzt den Arbeitstitel aus data/game.json in index.html ein (eine Quelle für den Namen). */
function appTitle(): Plugin {
  return {
    name: 'app-title',
    transformIndexHtml: (html) => html.replaceAll('%APP_TITLE%', game.title),
  };
}

export default defineConfig({
  base: '/',
  build: { target: 'es2022' },
  plugins: [
    appTitle(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
      manifest: {
        name: game.title,
        short_name: game.shortTitle,
        description: game.title,
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1d2a1f',
        theme_color: '#1d2a1f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { include: ['tests/sim/**/*.test.ts', 'tests/app/**/*.test.ts'] },
});
