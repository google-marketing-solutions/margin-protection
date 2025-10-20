import { defineConfig } from 'tsup';
import { cp } from 'fs/promises';

export default defineConfig({
  entry: {
    Code: 'client.ts',
  },
  format: 'iife',
  clean: true,
  outExtension() {
    return {
      js: '.js',
    };
  },
  publicDir: '../common/html',
  esbuildOptions(options) {
    options.banner = {
      js: `var global = this || globalThis;
function onOpen() {}
function initializeSheets() {}
function initializeRules() {}
function preLaunchQa() {}
function launchMonitor() {}
function displaySetupModal() {}
function displayGlossary() {}
      `,
    };
  },
  async onSuccess() {
    await cp('appsscript.json', 'dist/appsscript.json');
  },
});
