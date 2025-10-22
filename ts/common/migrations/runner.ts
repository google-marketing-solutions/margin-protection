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
 * distributed under the License is is "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ClientTypes, PropertyStore } from '../types.js';
import { Migration } from './types.js';
import { sortMigrations } from './utils.js';

/**
 * Configuration for the migration runner.
 */
export interface MigrationRunnerConfig<T extends ClientTypes<T>> {
  properties: PropertyStore;
  legacyMigrations: {
    readonly [version: string]: (frontend: T['frontend']) => void;
  };
  migrations: ReadonlyArray<Migration>;
  platform: string;
  currentAppVersion: string;
  frontend: T['frontend'];
}

/**
 * Runs all applicable migrations.
 * @param config The configuration for the runner.
 * @returns The number of migrations that were run.
 */
export function runMigrations<T extends ClientTypes<T>>(
  config: MigrationRunnerConfig<T>,
): number {
  const {
    properties,
    legacyMigrations,
    migrations,
    platform,
    currentAppVersion,
    frontend,
  } = config;
  let sheetVersion = properties.getProperty('sheet_version') ?? '0';
  let numberOfMigrations = 0;

  console.log(
    `Current sheet version: ${sheetVersion}. App version: ${currentAppVersion}`,
  );

  // Handle legacy SemVer migrations first.
  if (sheetVersion.split('.').length === 3 || sheetVersion === '0') {
    const sortedLegacyMigrations = Object.entries(legacyMigrations ?? {}).sort(
      ([v1], [v2]) => sortMigrations(v1, v2),
    );

    for (const [version, migration] of sortedLegacyMigrations) {
      if (sortMigrations(version, sheetVersion) > 0) {
        console.log(`Running legacy migration for version ${version}...`);
        migration(frontend);
        sheetVersion = version;
        properties.setProperty('sheet_version', sheetVersion);
        ++numberOfMigrations;
      }
    }
  }

  // Proceed with new date-based migrations.
  const sortedMigrations = [...migrations].sort((a, b) =>
    sortMigrations(a.name, b.name),
  );

  for (const migration of sortedMigrations) {
    if (
      migration.platforms.includes(platform) &&
      sortMigrations(migration.name, sheetVersion) > 0
    ) {
      console.log(`Running migration for version ${migration.name}...`);
      migration.apply();
      sheetVersion = migration.name;
      properties.setProperty('sheet_version', sheetVersion);
      ++numberOfMigrations;
    }
  }

  if (sortMigrations(currentAppVersion, sheetVersion) > 0) {
    properties.setProperty('sheet_version', String(currentAppVersion));
  }

  console.log(
    `Migrations complete. Ran ${numberOfMigrations} migration(s). Final sheet version: ${properties.getProperty('sheet_version')}`,
  );
  return numberOfMigrations;
}
