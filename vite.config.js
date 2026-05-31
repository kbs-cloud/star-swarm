/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  cacheDir: 'node_modules/.vite_cache',
  server: {
    host: '0.0.0.0',
    port: process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 8080),
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true
      }
    }
  },
})


