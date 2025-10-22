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

import { describe, beforeEach, it, expect } from 'vitest';
import {
  FakePropertyStore,
  mockAppsScript,
} from '#common/test_helpers/mock_apps_script.js';
import { runMigrations } from '../runner.js';
import { Migration } from '../types.js';
import { DisplayVideoFrontend } from '#dv360/frontend.js';

describe('Migration Runner', function () {
  let properties: FakePropertyStore;
  const executedMigrations: string[] = [];
  const legacyMigrations = {
    '2.0.0': function () {
      executedMigrations.push('2.0.0');
    },
    '2.1.0': function () {
      executedMigrations.push('2.1.0');
    },
    '2.1.4': function () {
      executedMigrations.push('2.1.4');
    },
    '2.2.0': function () {
      executedMigrations.push('2.2.0');
    },
    '3.0.0': function () {
      executedMigrations.push('3.0.0');
    },
  };
  const migrations: Migration[] = [
    {
      name: '20251020.0',
      version: '20251020.0',
      platforms: ['Fake'],
      apply: function () {
        executedMigrations.push('20251020.0');
      },
      description: 'Fake date-based migration.',
    },
  ];

  beforeEach(function () {
    mockAppsScript();
    properties = new FakePropertyStore();
    executedMigrations.length = 0; // Clear the array for each test
  });

  it('should run all legacy migrations in order if sheet version is old', function () {
    properties.setProperty('sheet_version', '1.0.0');
    runMigrations({
      properties,
      legacyMigrations,
      migrations: [],
      platform: 'Fake',
      currentAppVersion: '4.0.0',
      frontend: {} as DisplayVideoFrontend,
    });
    expect(executedMigrations).toEqual([
      '2.0.0',
      '2.1.0',
      '2.1.4',
      '2.2.0',
      '3.0.0',
    ]);
    expect(properties.getProperty('sheet_version')).to.equal('4.0.0');
  });

  it('should run only newer legacy migrations', function () {
    properties.setProperty('sheet_version', '2.1.0');
    runMigrations({
      properties,
      legacyMigrations,
      migrations: [],
      platform: 'Fake',
      currentAppVersion: '4.0.0',
      frontend: {} as unknown as DisplayVideoFrontend,
    });
    expect(executedMigrations).toEqual(['2.1.4', '2.2.0', '3.0.0']);
  });

  it('should transition from legacy to date-based migrations', function () {
    properties.setProperty('sheet_version', '2.2.0');
    runMigrations({
      properties,
      legacyMigrations,
      migrations,
      platform: 'Fake',
      currentAppVersion: '20251101.0',
      frontend: {} as unknown as DisplayVideoFrontend,
    });
    expect(executedMigrations).toEqual(['3.0.0', '20251020.0']);
    expect(properties.getProperty('sheet_version')).to.equal('20251101.0');
  });

  it('should not run legacy migrations if sheet version is already date-based', function () {
    properties.setProperty('sheet_version', '20251019.0');
    runMigrations({
      properties,
      legacyMigrations,
      migrations,
      platform: 'Fake',
      currentAppVersion: '20251101.0',
      frontend: {} as unknown as DisplayVideoFrontend,
    });
    expect(executedMigrations).toEqual(['20251020.0']);
  });

  it('should not run migrations for a different platform', function () {
    properties.setProperty('sheet_version', '0');
    runMigrations({
      properties,
      legacyMigrations: {},
      migrations,
      platform: 'OtherPlatform',
      currentAppVersion: '20251101.0',
      frontend: {} as unknown as DisplayVideoFrontend,
    });
    expect(executedMigrations).toEqual([]);
  });

  it('should update sheet version to app version even if no migrations are run', function () {
    properties.setProperty('sheet_version', '3.0.0');
    runMigrations({
      properties,
      legacyMigrations,
      migrations: [],
      platform: 'Fake',
      currentAppVersion: '4.0.0',
      frontend: {} as unknown as DisplayVideoFrontend,
    });
    expect(executedMigrations).toEqual([]);
    expect(properties.getProperty('sheet_version')).to.equal('4.0.0');
  });
});
