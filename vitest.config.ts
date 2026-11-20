import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: 'frontend',
  plugins: [vue()],
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'], clearMocks: true },
});
