import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import app from './vite.config.js';
const directory = path.dirname(fileURLToPath(import.meta.url));
const tests = path.resolve(directory, '../../ProjectSupport/Tests/FileSystem/Frontend');
// Tests live centrally; dependency resolution stays with this owning package.
export default mergeConfig(
  app,
  defineConfig({
    root: directory,
    server: { fs: { allow: [path.resolve(directory, '../..')] } },
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        'react-router',
        'react-markdown',
        '@testing-library/react',
        '@testing-library/jest-dom',
        'vitest',
        '@portfolio/browser-contracts',
      ],
    },
    test: {
      environment: 'jsdom',
      globals: true,
      dir: tests,
      include: configDefaults.include,
      setupFiles: [path.join(tests, 'test-setup.js')],
    },
  }),
);
