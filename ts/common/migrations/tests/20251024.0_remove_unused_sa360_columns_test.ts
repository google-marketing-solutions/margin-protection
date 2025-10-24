/**
 * @license
 * Copyright 2025 Google LLC.
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

import { mockAppsScript } from '../../test_helpers/mock_apps_script';
import { describe, beforeEach, it, expect } from 'vitest';
import { migration } from '../20251024.0_remove_unused_sa360_columns';

describe('Migration to remove unused SA360 settings', () => {
  beforeEach(() => {
    mockAppsScript();
  });

  it('should set exportTarget to "none" when LAUNCH_MONITOR_OPTION is "Spreadsheet Only"', () => {
    const sheet = SpreadsheetApp.getActive().insertSheet('General');
    sheet.getRange('A1:B2').setValues([
      ['LAUNCH_MONITOR_OPTION', 'Spreadsheet Only'],
      ['FULL_FETCH', 'TRUE'],
    ]);
    const settingsRange = sheet.getRange('C1');
    SpreadsheetApp.getActive().setNamedRange('SETTINGS', settingsRange);
    settingsRange.setValue('{}');

    migration.apply();

    const settings = JSON.parse(settingsRange.getValue());
    expect(settings.exportTarget.type).toBe('none');
    const remainingSettings = sheet
      .getDataRange()
      .getValues()
      .map((row) => row[0]);
    expect(remainingSettings.indexOf('LAUNCH_MONITOR_OPTION')).toBe(-1);
    expect(remainingSettings.indexOf('FULL_FETCH')).toBe(-1);
  });

  it('should set exportTarget to "drive" when LAUNCH_MONITOR_OPTION is "CSV Back-Up"', () => {
    const sheet = SpreadsheetApp.getActive().insertSheet('General');
    sheet
      .getRange('A1:B1')
      .setValues([['LAUNCH_MONITOR_OPTION', 'CSV Back-Up']]);
    const settingsRange = sheet.getRange('C1');
    SpreadsheetApp.getActive().setNamedRange('SETTINGS', settingsRange);
    settingsRange.setValue('{}');

    migration.apply();

    const settings = JSON.parse(settingsRange.getValue());
    expect(settings.exportTarget.type).toBe('drive');
  });

  it('should default to "none" if LAUNCH_MONITOR_OPTION is not present', () => {
    const sheet = SpreadsheetApp.getActive().insertSheet('General');
    sheet.getRange('A1:B1').setValues([['OTHER_SETTING', 'VALUE']]);
    const settingsRange = sheet.getRange('C1');
    SpreadsheetApp.getActive().setNamedRange('SETTINGS', settingsRange);
    settingsRange.setValue('{}');

    migration.apply();

    const settings = JSON.parse(settingsRange.getValue());
    expect(settings.exportTarget.type).toBe('none');
    const remainingSettings = sheet
      .getDataRange()
      .getValues()
      .map((row) => row[0]);
    expect(remainingSettings.indexOf('OTHER_SETTING')).toBe(0);
  });
});
