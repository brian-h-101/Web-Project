import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import app from './vite.config';
const directory = path.dirname(fileURLToPath(import.meta.url));
const tests = path.resolve(directory, '../ProjectSupport/Tests/Portfolio');
// Tests live centrally; dependency resolution stays with this owning package.
export default mergeConfig(
  app,
  defineConfig({
    root: directory,
    server: { fs: { allow: [path.resolve(directory, '..')] } },
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        'react-router-dom',
        '@testing-library/react',
        '@testing-library/user-event',
        '@testing-library/jest-dom',
        'vitest',
      ],
    },
    test: {
      environment: 'jsdom',
      css: false,
      dir: tests,
      include: configDefaults.include,
      setupFiles: [path.join(tests, 'test-setup.ts')],
    },
  }),
);
