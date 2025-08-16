import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: [
        'node-screenshots',
        'robotjs',
        'puppeteer',
        'puppeteer-core',
        'child_process',
        'fs',
        'path',
        'os'
      ]
    }
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['@robin/core']
  }
})
