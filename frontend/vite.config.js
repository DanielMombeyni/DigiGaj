import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Docker Desktop on Windows/macOS often misses inotify events on bind mounts.
const usePolling =
  process.env.CHOKIDAR_USEPOLLING === 'true' ||
  process.env.VITE_USE_POLLING === 'true'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling,
      interval: usePolling ? 300 : undefined,
    },
    hmr: {
      // Browser connects to host-mapped port, not the container hostname
      host: 'localhost',
      clientPort: 5173,
      protocol: 'ws',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
      },
      '/media': {
        target: process.env.VITE_PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
