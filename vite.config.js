/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
} catch (e) {
  // Ignore
}
export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true
  },
  base: './',
  cacheDir: 'node_modules/.vite_cache',
  server: {
    host: '0.0.0.0',
    port: process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 28002),
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 29002}`,
        changeOrigin: true,
        xfwd: true
      }
    }
  },
})


