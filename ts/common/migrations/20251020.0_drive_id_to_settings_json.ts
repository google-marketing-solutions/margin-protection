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
} from '../sheet_helpers/index.js';
import { Migration } from './types.js';

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

    const driveId =
      driveIdRange && driveIdRange.getValue()
        ? String(driveIdRange.getValue())
        : '';
    const sheet = HELPERS.getOrCreateSheet(GENERAL_SETTINGS_SHEET);
    const insertRow = driveIdRange
      ? driveIdRange.getRow()
      : sheet.getLastRow() + 1;
    let settingsRange: GoogleAppsScript.Spreadsheet.Range | null = null;
    try {
      settingsRange = active.getRangeByName('SETTINGS');
    } catch (_e) {
      // Doesn't exist, we will create it below.
    }

    if (!settingsRange) {
      // Insert a row at the position of the old DRIVE_ID range.
      sheet
        .getRange(insertRow, 1, 1, 2)
        .insertCells(SpreadsheetApp.Dimension.ROWS);

      // Now create the new SETTINGS range in this row.
      const newSettingsCell = sheet.getRange(`B${insertRow}`);
      active.setNamedRange('SETTINGS', newSettingsCell);
      addSettingWithDescription(sheet, `A${insertRow}`, [
        'Settings',
        `A JSON object for storing various configurations. It\'s STRONGLY recommended that you 
        use Launch Monitor > Settings to modify this field.`,
      ]);
      settingsRange = newSettingsCell;
    }

    let settings: AppSettings = {};
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

    if (driveId) {
      if (
        settings.exportTarget?.type === 'drive' &&
        settings.exportTarget.config.folder === driveId
      ) {
        console.log(
          'Skipping Drive ID migration: New setting already exists and matches.',
        );
      } else {
        settings.exportTarget = {
          type: 'drive',
          config: { folder: driveId },
        };
        settingsRange.setValue(JSON.stringify(settings, null, 2));
        console.log(
          `Successfully migrated Drive ID '${driveId}' to settings JSON.`,
        );
      }
    } else {
      console.log('Skipping Drive ID migration: No old value to migrate.');
    }

    active.removeNamedRange('DRIVE_ID');
    console.log("Cleaned up and removed old 'DRIVE_ID' named range.");
  }
}

import { AppSettings } from '../types.js';

export const migration = new DriveIdToSettingsJson();
