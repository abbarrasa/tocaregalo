import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  root: 'frontend',
  plugins: [vue(), basicSsl()],
  build: { outDir: '../dist/frontend', emptyOutDir: true },
  server: {
    host: 'localhost', port: 5173, strictPort: true,
    proxy: { 
      '/api': { 
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    },
  },
});
