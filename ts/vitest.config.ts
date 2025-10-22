/**
 * @fileoverview Vitest configuration file for the shared package.
 *
 * This configuration sets up the Vitest test runner. It includes the
 * `vite-tsconfig-paths` plugin to allow the use of TypeScript path aliases
 * (e.g., `shared/*`) within the test files, ensuring that module resolution
 * works correctly.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/tests/**/*_test.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^(sa360|dv360|googleads)\/(.*)/,
        replacement: path.resolve(import.meta.dirname, './$1/src/$2'),
      },
      {
        find: /^(dv360_api|common)\/(.*)/,
        replacement: path.resolve(import.meta.dirname, './$1/$2'),
      },
    ],
  },
});
