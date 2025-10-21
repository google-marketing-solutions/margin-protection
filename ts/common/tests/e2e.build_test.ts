/**
 * @license
 * Copyright 2025 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may not use this file except in compliance with the License.
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

import 'mocha';
import { Volume, createFsFromVolume } from 'memfs';
import { IFS, IUnionFs, ufs } from 'unionfs';
import * as fs from 'fs';
import * as path from 'path';
import * as proxyquire from 'proxyquire';
import { expect } from 'vitest';

const __dirname = import.meta.dirname;

describe('E2E Build Test', function() {
  let projectRoot: string;
  let dv360Root: string;
  let unionfs: IUnionFs;

  beforeAll(() => {
    projectRoot =  path.resolve(__dirname, '..');
    dv360Root = path.join(projectRoot, 'dv360');
    const vol = new Volume();
    unionfs = ufs.use(fs).use(createFsFromVolume(vol) as unknown as IFS);
  });

  it('should build the dv360 package into an in-memory dist directory', async function() {
    this.timeout(20000); // Increase timeout for build process

    const tsup = proxyquire('tsup', { fs: unionfs });
    
    const { getTsupConfig } = await import('../build');
    const outDir = path.join(dv360Root, 'dist');
    const options = getTsupConfig(dv360Root, outDir);
    await tsup.build(options);

    const distPath = path.join(dv360Root, 'dist');
    const distExists = unionfs.existsSync(distPath);
    expect(distExists).toBeTruthy();

  });

  it('should have the expected file structure', async () => {
    const files = unionfs.readdirSync(distPath);
    const includedValues = ['main.js', 'appsscript.json', 'glossary.html', 'guide.html'];
    expect(files).toEqual(includedValues);
  });

  describe('Black-box tests for the built dv360 package', function() {
    it('should have a public API that works as expected', function() {
      // Your black-box tests for the public API of the built package will go here.
      // This is a placeholder for the actual tests.
      console.log('Running black-box tests for dv360...');
    });
  });
});
