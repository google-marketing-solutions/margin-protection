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
 * Unless required by applicable law of agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  addSettingWithDescription,
  GENERAL_SETTINGS_SHEET,
  HELPERS,
} from '../sheet_helpers';
import { Migration } from './types';

/**
 * A migration to move the Drive Folder ID into a unified JSON object.
 */
class DriveIdToSettingsJson implements Migration {
  name = '20251020.0';
  version = '20251020.0';
  readonly description =
    'Migrates Drive Folder ID from a dedicated cell to a unified JSON object in settings.';
  readonly platforms = ['dv360', 'sa360'];

  apply() {
    const active = SpreadsheetApp.getActive();
    let driveIdRange: GoogleAppsScript.Spreadsheet.Range | null = null;

    try {
      driveIdRange = active.getRangeByName('DRIVE_ID');
    } catch (_e) {
      console.log(
        'Skipping Drive ID migration: DRIVE_ID named range not found.',
      );
      return;
    }

    if (!driveIdRange || !driveIdRange.getValue()) {
      console.log('Skipping Drive ID migration: No old value to migrate.');
      return;
    }
    const driveId = String(driveIdRange.getValue());

    const sheet = HELPERS.getOrCreateSheet(GENERAL_SETTINGS_SHEET);
    let settingsRange: GoogleAppsScript.Spreadsheet.Range | null = null;
    try {
      settingsRange = active.getRangeByName('SETTINGS');
    } catch (_e) {
      // Doesn't exist, we will create it below.
    }

    if (!settingsRange) {
      const lastRow = sheet.getLastRow();
      const newRow = lastRow + 1;
      const newSettingsCell = sheet.getRange(`B${newRow}:C${newRow}`).merge();
      active.setNamedRange('SETTINGS', newSettingsCell);
      addSettingWithDescription(sheet, `A${newRow}`, [
        'Settings',
        'A JSON object for storing various configurations.',
      ]);
      settingsRange = newSettingsCell;
    }

    let settings: { driveFolderId?: string } = {};
    const existingSettingsJson = settingsRange.getValue();
    if (existingSettingsJson && typeof existingSettingsJson === 'string') {
      try {
        settings = JSON.parse(existingSettingsJson);
      } catch (_e) {
        console.log(
          'Could not parse existing settings JSON, will overwrite parts of it.',
        );
      }
    }

    if (settings.driveFolderId === driveId) {
      console.log(
        'Skipping Drive ID migration: New setting already exists and matches.',
      );
      driveIdRange.clear(); // Clean up old value if it still exists
      return;
    }

    settings.driveFolderId = driveId;
    settingsRange.setValue(JSON.stringify(settings, null, 2));
    driveIdRange.clear();
    console.log(
      `Successfully migrated Drive ID '${driveId}' to settings JSON.`,
    );
  }
}

export const migration = new DriveIdToSettingsJson();
