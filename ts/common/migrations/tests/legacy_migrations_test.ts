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

import { LEGACY_MIGRATIONS } from '#common/migrations/legacy_migrations.js';
import { FakeClient } from '#common/tests/helpers.js';
import {
  FakePropertyStore,
  mockAppsScript,
} from '#common/test_helpers/mock_apps_script.js';
import { scaffoldSheetWithNamedRanges } from '#common/tests/helpers.js';
import { DisplayVideoFrontend } from '#dv360/frontend.js';
import { ClientInterface } from '#dv360/types.js';
import { RuleRange } from '#dv360/client.js';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

describe('Full migration path', function () {
  beforeEach(function () {
    mockAppsScript();
    scaffoldSheetWithNamedRanges();
  });

  afterEach(function () {
    vi.restoreAllMocks();
  });

  it('should upgrade from 1.0 to the latest version', function () {
    // Arrange
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty('sheet_version', '1.0');
    const activeSpreadsheet = SpreadsheetApp.getActive();
    SpreadsheetApp.getActive()
      .getRangeByName('DRIVE_ID')!
      .setValue('old-drive-folder-id');
    SpreadsheetApp.getActive().getRangeByName('SETTINGS')!.setValue('{}');
    SpreadsheetApp.getActive().getRangeByName('SETTINGS')!.setValue('{}');

    const frontend = DisplayVideoFrontend.withIdentity({
      properties,
      rules: [],
      ruleRangeClass: RuleRange,
      clientInitializer: () =>
        new FakeClient(
          'test',
          new FakePropertyStore(),
        ) as unknown as ClientInterface,
      version: '3.0.0',
    });

    // Act
    frontend.migrate();

    // Assert
    // Check that the date-based migration ran by verifying the final state
    const settingsRange = activeSpreadsheet.getRangeByName('SETTINGS');
    expect(settingsRange).to.exist;
    const newSettings = JSON.parse(
      SpreadsheetApp.getActive().getRangeByName('SETTINGS')!.getValue(),
    );
    expect(newSettings.driveFolderId).to.equal('old-drive-folder-id');
    // Check that the version is updated
    expect(properties.getProperty('sheet_version')).to.equal('20251020.0');
    // Check that legacy migrations ran by checking for a created sheet.
    const generalSettingsSheet =
      activeSpreadsheet.getSheetByName('General/Settings');
    expect(generalSettingsSheet).to.exist;
  });
});

describe('Legacy Migrations', function () {
  beforeEach(function () {
    // Set up a fresh mock environment for each test, per best practices.
    mockAppsScript();
  });

  afterEach(function () {
    vi.restoreAllMocks();
  });

  describe('Migration 1.3', function () {
    it('should create REPORT_LABEL and DRIVE_ID named ranges if they do not exist', function () {
      // Arrange
      const activeSpreadsheet = SpreadsheetApp.getActive();
      vi.spyOn(activeSpreadsheet, 'getRangeByName').mockReturnValue(undefined);
      const setNamedRangeSpy = vi.spyOn(activeSpreadsheet, 'setNamedRange');

      // Act
      const migration = LEGACY_MIGRATIONS['1.3'] as (
        frontend?: DisplayVideoFrontend,
      ) => void;
      migration();

      // Assert
      expect(setNamedRangeSpy).toHaveBeenCalledTimes(2);
      expect(setNamedRangeSpy).toHaveBeenCalledWith(
        'REPORT_LABEL',
        expect.any(Object),
      );
      expect(setNamedRangeSpy).toHaveBeenCalledWith(
        'DRIVE_ID',
        expect.any(Object),
      );
    });

    it('should not run if REPORT_LABEL named range already exists', function () {
      // Arrange
      const activeSpreadsheet = SpreadsheetApp.getActive();
      const fakeRange = activeSpreadsheet.getActiveSheet().getRange('A1');
      vi.spyOn(activeSpreadsheet, 'getRangeByName').mockImplementation(
        (label) => {
          if (label === 'REPORT_LABEL') {
            return fakeRange;
          }
          return activeSpreadsheet.getRangeByName(label);
        },
      );
      const setNamedRangeSpy = vi.spyOn(activeSpreadsheet, 'setNamedRange');

      // Act
      const migration = LEGACY_MIGRATIONS['1.3'] as (
        frontend?: DisplayVideoFrontend,
      ) => void;
      migration();

      // Assert
      expect(setNamedRangeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Migration 2.2.0', function () {
    it('should create EXPORT_SETTINGS named range and set its value if it does not exist', function () {
      // Arrange
      const activeSpreadsheet = SpreadsheetApp.getActive();
      vi.spyOn(activeSpreadsheet, 'getRangeByName').mockImplementation(
        (rangeName) => {
          if (rangeName === 'EXPORT_SETTINGS') {
            return undefined;
          }
          return activeSpreadsheet.getRangeByName(rangeName);
        },
      );
      const setNamedRangeSpy = vi.spyOn(activeSpreadsheet, 'setNamedRange');

      // Act
      const migration = LEGACY_MIGRATIONS['2.2.0'] as (
        frontend?: DisplayVideoFrontend,
      ) => void;
      migration();

      // Assert: Test the final state of the sheet, not just the calls.
      expect(setNamedRangeSpy).toHaveBeenCalledExactlyOnceWith(
        'EXPORT_SETTINGS',
        expect.any(Object),
      );
      const sheet = activeSpreadsheet.getSheetByName('General/Settings');
      expect(sheet).to.not.be.null; // Ensure the sheet was created
      expect(sheet.getRange('B8').getValue()).to.equal('drive');
    });

    it('should not run if EXPORT_SETTINGS named range already exists', function () {
      // Arrange
      const activeSpreadsheet = SpreadsheetApp.getActive();
      const fakeRange = activeSpreadsheet.getActiveSheet().getRange('A1');
      vi.spyOn(activeSpreadsheet, 'getRangeByName').mockImplementation(
        (rangeName) => {
          if (rangeName === 'EXPORT_SETTINGS') {
            return fakeRange;
          }
          return activeSpreadsheet.getRangeByName(rangeName);
        },
      );
      const setNamedRangeSpy = vi.spyOn(activeSpreadsheet, 'setNamedRange');

      // Act
      const migration = LEGACY_MIGRATIONS['2.2.0'] as (
        frontend?: DisplayVideoFrontend,
      ) => void;
      migration();

      // Assert
      expect(setNamedRangeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Migration 1.2', function () {
    it('should gzip properties that are JSON', function () {
      // Arrange
      const properties = {
        'pacingDays-123': '{"key":"value"}',
        'impressionsByGeo-456': '{"foo":"bar"}',
        notAJson: 'just a string',
        'pacingPercent-789': 'not a json string',
      };
      const scriptProperties = PropertiesService.getScriptProperties();
      vi.spyOn(scriptProperties, 'getProperties').mockReturnValue(properties);
      const setPropertiesSpy = vi.spyOn(scriptProperties, 'setProperties');

      // Act
      const migration = LEGACY_MIGRATIONS['1.2'] as (
        frontend?: DisplayVideoFrontend,
      ) => void;
      migration();

      // Assert
      expect(setPropertiesSpy).toHaveBeenCalledExactlyOnceWith({
        'pacingDays-123': 'gzipped:{"key":"value"}',
        'impressionsByGeo-456': 'gzipped:{"foo":"bar"}',
        notAJson: 'just a string',
        'pacingPercent-789': 'not a json string',
      });
    });
  });
});
