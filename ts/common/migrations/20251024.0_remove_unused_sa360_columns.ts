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
import { Migration } from './types.js';

/**
 * Removes unused rows from the General sheet and migrates the
 * LAUNCH_MONITOR_OPTION setting.
 */
export const migration: Migration = {
  name: 'RemoveUnusedSa360Columns',
  description:
    'Removes unused rows from the General sheet and migrates the LAUNCH_MONITOR_OPTION setting.',
  platforms: ['sa360'],
  version: '2.1',
  apply: () => {
    const sheet = SpreadsheetApp.getActive().getSheetByName('General');
    if (!sheet) {
      return;
    }
    const data = sheet.getDataRange().getValues();
    const settingsColumn = data.map((row) => row[0]);
    const launchMonitorOptionIndex = settingsColumn.indexOf(
      'LAUNCH_MONITOR_OPTION',
    );
    let exportType = 'none';

    if (launchMonitorOptionIndex > -1) {
      const launchMonitorOptionValue = data[launchMonitorOptionIndex][1];
      if (launchMonitorOptionValue === 'CSV Back-Up') {
        exportType = 'drive';
      }
    }

    const settingsRange = SpreadsheetApp.getActive().getRangeByName('SETTINGS');
    const settings = settingsRange
      ? JSON.parse(settingsRange.getValue() || '{}')
      : {};
    settings.exportTarget = { type: exportType };

    if (settingsRange) {
      settingsRange.setValue(JSON.stringify(settings));
    }

    const rowsToDelete = ['LAUNCH_MONITOR_OPTION', 'FULL_FETCH'];
    for (let i = data.length - 1; i >= 0; i--) {
      if (rowsToDelete.includes(data[i][0])) {
        sheet.deleteRow(i + 1);
      }
    }
  },
};
