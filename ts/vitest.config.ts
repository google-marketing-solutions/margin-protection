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
    include: ['dv360/src/tests/frontend_test.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^(common|sa360|dv360|dv360_api|googleads)\/(.*)/,
        replacement: path.resolve(import.meta.dirname, './$1/$2'),
      },
    ],
  },
});
