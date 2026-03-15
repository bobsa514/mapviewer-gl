/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages needs '/mapviewer-gl/', Vercel needs '/'
  base: process.env.GITHUB_ACTIONS ? '/mapviewer-gl/' : '/',
  build: {
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-deckgl': [
            '@deck.gl/core',
            '@deck.gl/layers',
            '@deck.gl/react',
            '@deck.gl/geo-layers',
            '@deck.gl/extensions',
            '@deck.gl/mesh-layers',
            '@deck.gl/widgets',
            'deck.gl',
          ],
          'vendor-h3': ['h3-js'],
        },
      },
      onwarn(warning, warn) {
        // Suppress unresolved import warnings for optional deck.gl / loaders.gl sub-packages
        if (
          warning.code === 'UNRESOLVED_IMPORT' &&
          (warning.exporter?.includes('@deck.gl/') || warning.exporter?.includes('@loaders.gl/'))
        ) return;
        warn(warning);
      }
    }
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm']
  },
  test: {
    globals: true,
    environment: 'node',
  },
  server: {
    fs: {
      strict: true
    },
    hmr: {
      overlay: false
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
})
