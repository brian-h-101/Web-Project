import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  base: '/demos/file-system-simulator/',

  server: {
    host: '127.0.0.1',
    port: 5176,
    strictPort: true,

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5190',
        changeOrigin: true,
      },
    },
  },

  preview: {
    host: '127.0.0.1',
    port: 4176,
    strictPort: true,
  },

  build: {
    outDir: 'dist',
  },
});