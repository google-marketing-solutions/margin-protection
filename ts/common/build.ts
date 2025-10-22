/**
 * @license
 * Copyright 2025 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Options } from 'tsup';
import { cp } from 'fs/promises';
import * as path from 'path';

/**
 * Generates a tsup configuration for a package.
 *
 * @param packageRoot The root directory of the package.
 * @param outDir The output directory for the build.
 * @returns A tsup configuration object.
 */
export function getTsupConfig(packageRoot: string, outDir: string): Options {
  const commonRoot = path.resolve(packageRoot, '..', 'common');
  return {
    entry: [path.join(packageRoot, 'src/main.ts')],
    format: 'iife',
    clean: true,
    outDir,
    outExtension() {
      return { js: '.js' };
    },
    publicDir: path.join(commonRoot, 'html'),
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
      await cp(
        path.join(packageRoot, 'appsscript.json'),
        path.join(outDir, 'appsscript.json'),
      );
    },
  };
}
