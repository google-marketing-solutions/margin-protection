#!/usr/bin/env node
/**
 * @license
 * Copyright 2024 Google LLC.
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

import { glob } from 'glob';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

/**
 * Migration: Ensures all .clasp.json files have their rootDir set to './dist'.
 */
export default async function () {
  console.log('  Running migration: 001-clasp-rootdir-to-dist...');
  const files = await glob('**/.*clasp.json', {
    ignore: '**/node_modules/**',
  });

  for (const file of files) {
    const filePath = resolve(process.cwd(), file);
    try {
      const content = await readFile(filePath, 'utf-8');
      const config = JSON.parse(content);

      if (config.rootDir && config.rootDir !== './dist') {
        console.log(`    Updating rootDir in ${file}...`);
        config.rootDir = './dist';
        const newContent = JSON.stringify(config, null, 2);
        await writeFile(filePath, newContent);
      }
    } catch (error) {
      console.error(`    Error processing ${file}:`, error);
    }
  }
}
