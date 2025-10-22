/**
 * @license
 * Copyright 2025 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with a copy of the License.
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

import { Volume, createFsFromVolume } from 'memfs';
import { IFS, ufs } from 'unionfs';
import * as fs from 'fs';
import * as path from 'path';
import { expect, vi, describe, beforeAll, test, it, afterAll } from 'vitest';

const __dirname = import.meta.dirname;

vi.mock('fs', async (importOriginal) => {
  const originalFs = await importOriginal<typeof fs>();
  const vol = new Volume();
  const unionfs = ufs
    .use(originalFs)
    .use(createFsFromVolume(vol) as unknown as IFS);
  return {
    ...unionfs,
    default: unionfs,
  };
});

describe('E2E Build Test', () => {
  let projectRoot: string;
  let dv360Root: string;
  let distPath: string;

  beforeAll(async () => {
    projectRoot = path.resolve(__dirname, '..', '..');
    dv360Root = path.join(projectRoot, 'dv360');
    distPath = path.join(dv360Root, 'dist');

    const { getTsupConfig } = await import('../build');
    const outDir = path.join(dv360Root, 'dist');
    const options = getTsupConfig(dv360Root, outDir);
    const tsup = await import('tsup');
    await tsup.build(options);
  }, 20000);

  afterAll(() => {
    vi.unmock('fs');
  });

  test('should build the dv360 package into an in-memory dist directory', () => {
    const distExists = fs.existsSync(distPath);
    expect(distExists).toBeTruthy();
  });

  it('should have the expected file structure', async () => {
    const files = fs.readdirSync(distPath);
    const includedValues = [
      'main.js',
      'appsscript.json',
      'glossary.html',
      'guide.html',
    ];
    expect(files.sort()).toEqual(includedValues.sort());
  });

  describe('Black-box tests for the built dv360 package', () => {
    it('should have a public API that works as expected', () => {
      // Your black-box tests for the public API of the built package will go here.
      // This is a placeholder for the actual tests.
      console.log('Running black-box tests for dv360...');
    });
  });
});
