import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/demos/commerce-ordering-platform/',

  plugins: [react()],

  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5180',
        changeOrigin: true,
      },
    },
  },

  preview: {
    host: '127.0.0.1',
    port: 4175,
    strictPort: true,
  },

  build: {
    outDir: 'dist',
  },
});