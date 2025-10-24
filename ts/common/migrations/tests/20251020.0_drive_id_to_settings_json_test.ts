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

import { mockAppsScript } from '../../test_helpers/mock_apps_script.js';
import { migration } from '../20251020.0_drive_id_to_settings_json.js';
import { scaffoldSheetWithNamedRanges } from '../../tests/helpers.js';
import { describe, beforeEach, it, expect } from 'vitest';

describe('DriveIdToSettingsJson Migration', () => {
  let activeSpreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;

  beforeEach(() => {
    mockAppsScript();
    activeSpreadsheet = SpreadsheetApp.getActive();
  });

  it('should migrate a drive ID to the settings JSON and remove the old range', () => {
    // Arrange
    scaffoldSheetWithNamedRanges({
      namedRanges: [
        ['DRIVE_ID', 'old-drive-id'],
        ['SETTINGS', ''],
      ],
    });
    const settingsRange = activeSpreadsheet.getRangeByName('SETTINGS');

    // Act
    migration.apply();

    // Assert
    const newSettings = JSON.parse(settingsRange!.getValue());
    expect(newSettings).toEqual({
      exportTarget: {
        type: 'drive',
        config: { folder: 'old-drive-id' },
      },
    });
    expect(activeSpreadsheet.getRangeByName('DRIVE_ID')).toBeUndefined();
  });

  it('should remove the old range if it exists but is empty', () => {
    // Arrange
    scaffoldSheetWithNamedRanges({
      namedRanges: [
        ['DRIVE_ID', ''],
        ['SETTINGS', ''],
      ],
    });
    const settingsRange = activeSpreadsheet.getRangeByName('SETTINGS');

    // Act
    migration.apply();

    // Assert
    expect(settingsRange!.getValue()).toBe('');
    expect(activeSpreadsheet.getRangeByName('DRIVE_ID')).toBeUndefined();
  });

  it('should preserve existing settings when migrating', () => {
    // Arrange
    scaffoldSheetWithNamedRanges({
      namedRanges: [
        ['DRIVE_ID', 'new-drive-id'],
        ['SETTINGS', JSON.stringify({ someOtherSetting: 'value' })],
      ],
    });
    const settingsRange = activeSpreadsheet.getRangeByName('SETTINGS');

    // Act
    migration.apply();

    // Assert
    const newSettings = JSON.parse(settingsRange!.getValue());
    expect(newSettings).toEqual({
      someOtherSetting: 'value',
      exportTarget: {
        type: 'drive',
        config: { folder: 'new-drive-id' },
      },
    });
    expect(activeSpreadsheet.getRangeByName('DRIVE_ID')).toBeUndefined();
  });

  it('should do nothing if the DRIVE_ID named range does not exist', () => {
    // Arrange
    scaffoldSheetWithNamedRanges({
      namedRanges: [['SETTINGS', '']],
    });
    const settingsRange = activeSpreadsheet.getRangeByName('SETTINGS');
    const initialSettings = settingsRange!.getValue();

    // Act
    migration.apply();

    // Assert
    expect(settingsRange!.getValue()).toBe(initialSettings);
  });

  it('should remove the old range even if the new setting already exists', () => {
    // Arrange
    const settings = {
      exportTarget: { type: 'drive', config: { folder: 'existing-id' } },
    };
    scaffoldSheetWithNamedRanges({
      namedRanges: [
        ['DRIVE_ID', 'existing-id'],
        ['SETTINGS', JSON.stringify(settings)],
      ],
    });
    const settingsRange = activeSpreadsheet.getRangeByName('SETTINGS');

    // Act
    migration.apply();

    // Assert
    expect(JSON.parse(settingsRange!.getValue())).toEqual(settings);
    expect(activeSpreadsheet.getRangeByName('DRIVE_ID')).toBeUndefined();
  });
});
