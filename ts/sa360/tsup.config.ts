import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
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
});
