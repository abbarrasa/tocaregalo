import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Keep optimized modules outside dot paths protected by Nginx.
  cacheDir: 'node_modules/vite-cache',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['tocaregalo-nginx'],
  },
})
