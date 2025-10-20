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

import { readdir, readFile, appendFile } from 'fs/promises';
import { resolve, join } from 'path';

const MIGRATIONS_DIR = resolve(process.cwd(), 'scripts/migrations');
const MIGRATIONS_LOG = resolve(process.cwd(), '.migrations_ran');

/**
 * A simple migration runner.
 */
async function runMigrations() {
  console.log('Starting migration check...');
  let ranMigrations = [];
  try {
    ranMigrations = (await readFile(MIGRATIONS_LOG, 'utf-8')).split('\n');
  } catch (_e) {
    // Log file doesn't exist, which is fine.
  }

  const allMigrations = (await readdir(MIGRATIONS_DIR)).sort();
  const pendingMigrations = allMigrations.filter(
    (m) => !ranMigrations.includes(m),
  );

  if (pendingMigrations.length === 0) {
    console.log('No new migrations to run.');
    return;
  }

  console.log(`Found ${pendingMigrations.length} pending migration(s).`);

  for (const migrationFile of pendingMigrations) {
    try {
      const migrationPath = join(MIGRATIONS_DIR, migrationFile);
      const { default: migration } = await import(migrationPath);
      await migration();
      await appendFile(MIGRATIONS_LOG, `${migrationFile}\n`);
      console.log(`  Successfully ran and logged ${migrationFile}.`);
    } catch (error) {
      console.error(`Migration ${migrationFile} failed:`, error);
      process.exit(1);
    }
  }

  console.log('All pending migrations completed successfully.');
}

runMigrations();
