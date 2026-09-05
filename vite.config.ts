import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Point at the real backend once it exists; until then MSW answers
      // these paths in the browser and this proxy stays inert.
      // '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
