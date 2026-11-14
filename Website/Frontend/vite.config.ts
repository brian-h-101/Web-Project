import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import projectConfig from '../Systems/Configuration/project.json';

const siteUrl = `https://${projectConfig.Website.Domain}`;

export default defineConfig({
  plugins: [react()],
  define: {
    __SITE_URL__: JSON.stringify(siteUrl),
  },
  build: {
    outDir: 'dist',
  },
});