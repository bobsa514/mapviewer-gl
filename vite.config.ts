import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/mapviewer-gl/',
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Increase chunk size warning limit to 1000kb
  },
  server: {
    fs: {
      strict: false
    },
    hmr: {
      overlay: false
    }
  }
})
