import { esbuildPlugin } from '@web/dev-server-esbuild';
import { fromRollup } from '@web/dev-server-rollup';
import { typescriptPaths } from 'rollup-plugin-typescript-paths';
import { fileURLToPath } from 'url';
import { jasmineTestRunnerConfig } from 'web-test-runner-jasmine';
import { playwrightLauncher } from '@web/test-runner-playwright';

import * as os from 'os';

const tsPaths = fromRollup(typescriptPaths);

export default {
  ...jasmineTestRunnerConfig(),
  nodeResolve: true,
  files: ['**/*_test.ts'],
  //hostname: os.hostname(),
  plugins: [
    tsPaths({
      preserveExtensions: true,
      absolute: true,
      nonRelative: false,
      tsConfigPath: './tsconfig.json',
    }),
    esbuildPlugin({
      ts: true,
      tsconfig: fileURLToPath(new URL('./tsconfig.json', import.meta.url)),
    }),
  ],
  browsers: [
    playwrightLauncher({ product: 'chromium' })
  ]
};
