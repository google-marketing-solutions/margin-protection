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

import 'mocha';
import { expect } from 'chai';
import { mockAppsScript } from '../../test_helpers/mock_apps_script';
import { migration } from '../20251020.0_drive_id_to_settings_json';
import { scaffoldSheetWithNamedRanges } from '../../tests/helpers';

describe('DriveIdToSettingsJson Migration', function () {
  beforeEach(function () {
    mockAppsScript();
    scaffoldSheetWithNamedRanges();
  });

  it('should migrate the drive ID to the new settings JSON', function () {
    // Arrange
    const activeSpreadsheet = SpreadsheetApp.getActive();
    const driveIdRange = activeSpreadsheet.getRangeByName('DRIVE_ID');
    driveIdRange!.setValue('old-drive-folder-id');
    const settingsRange = activeSpreadsheet.getRangeByName('SETTINGS');
    settingsRange!.setValue(''); // Ensure it's empty to start

    // Act
    migration.apply();

    // Assert
    const newSettings = JSON.parse(settingsRange!.getValue());
    expect(newSettings).to.deep.equal({
      driveFolderId: 'old-drive-folder-id',
    });
    expect(driveIdRange!.getValue()).to.equal('');
  });
});
