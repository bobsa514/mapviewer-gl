import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/mapviewer-gl/',
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress unresolved import warnings for optional deck.gl sub-packages
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.exporter?.includes('@deck.gl/')) return;
        warn(warning);
      }
    }
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm']
  },
  server: {
    fs: {
      strict: false
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
