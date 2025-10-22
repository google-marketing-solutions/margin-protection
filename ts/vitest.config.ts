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

process.env['DEBUG_PRINT_LIMIT'] = '120';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/tests/**/*_test.ts'],
    reporters: ['dot'],
    silent: 'passed-only',
  },
  resolve: {
    alias: [
      {
        find: /^#(sa360|dv360|googleads)\/(.*)/,
        replacement: path.resolve(__dirname, './$1/src/$2.js'),
      },
      {
        find: /^#(dv360_api|common)\/(.*)/,
        replacement: path.resolve(__dirname, './$1/$2.js'),
      },
    ],
  },
});
