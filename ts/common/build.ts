/**
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

import { defineConfig, Options } from 'tsup';
import { copyFile } from 'fs/promises';
import { getNextVersion, writeVersionFile } from './generate-version.js';
import * as path from 'path';
import { BuildablePackage } from '#common/types.js';

/**
 * Generates a tsup configuration for a package.
 *
 * @param packageRoot The root directory of the package.
 * @param outDir The output directory for the build.
 * @returns A tsup configuration object.
 */
export function getTsupConfig(packageRoot: string, outDir: string) {
  const commonRoot = path.resolve(packageRoot, '..', 'common');
  return defineConfig({
    entry: [
      path.join(packageRoot, 'src/main.ts'),
      path.join(packageRoot, 'src/version.ts'),
    ],
    format: 'iife',
    clean: true,
    outDir,
    outExtension() {
      return { js: '.js' };
    },
    publicDir: path.join(commonRoot, 'public'),
    esbuildOptions(options) {
      options.banner = {
        js: `/**
 * Copyright 2024 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law of agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var global = global || globalThis;
 `,
      };
    },
    async onSuccess() {
      await copyFile(
        path.join(packageRoot, 'appsscript.json'),
        path.join(outDir, 'appsscript.json'),
      );
    },
  } as Options);
}

export async function preBuild(
  packageDir: BuildablePackage,
  projectRoot: string,
) {
  const version = await getNextVersion(packageDir);
  await writeVersionFile(packageDir, version, projectRoot);
}

/**
 * Builds a package, including version generation.
 *
 * @param packageRoot The root directory of the package to build.
 * @param projectRoot The root of the entire project.
 */
export async function buildPackage(
  packageDir: BuildablePackage,
  projectRoot: string,
) {
  const version = await getNextVersion(packageDir);
  const packageRoot = path.resolve(projectRoot, packageDir);

  const outDir = path.join(packageRoot, 'dist');
  const options = getTsupConfig(packageRoot, outDir);
  const tsup = await import('tsup');
  await tsup.build(options as Options);
  return version;
}
