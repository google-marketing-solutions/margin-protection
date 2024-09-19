const { esbuildPlugin } = await import('@web/dev-server-esbuild');
const { fromRollup } = await import('@web/dev-server-rollup');
const { typescriptPaths } = await import('rollup-plugin-typescript-paths');
const { fileURLToPath } = await import('url');
const { jasmineTestRunnerConfig } = await import('web-test-runner-jasmine');
const { playwrightLauncher } = await import('@web/test-runner-playwright');

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
  browsers: [playwrightLauncher({ product: 'chromium' })],
};
