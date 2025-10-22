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

import {
  addSettingWithDescription,
  HELPERS,
} from '#common/sheet_helpers/index.js';
import { RuleRange } from '#dv360/client.js';
import { RuleGranularity } from '#dv360/types.js';
import { DisplayVideoFrontend } from '#dv360/frontend.js';

const REPORT_LABEL = 'REPORT_LABEL';
const DRIVE_ID = 'DRIVE_ID';
const EXPORT_SETTINGS = 'EXPORT_SETTINGS';

/**
 * A list of legacy migrations.
 */
export const LEGACY_MIGRATIONS: Record<
  string,
  (frontend: DisplayVideoFrontend) => void
> = {
  '1.1': (frontend) => {
    const active = SpreadsheetApp.getActive();
    const ruleSettingsSheet = active.getSheetByName('Rule Settings');
    if (!ruleSettingsSheet) {
      return;
    }
    let campaignValues: string[][] = [[]];
    let ioValues: string[][] = [[]];

    const ruleRange = new RuleRange(
      ruleSettingsSheet.getDataRange().getValues(),
      frontend.client,
    );
    campaignValues = ruleRange.getValues(RuleGranularity.CAMPAIGN);
    ioValues = ruleRange.getValues(RuleGranularity.INSERTION_ORDER);
    active.deleteSheet(ruleSettingsSheet);
    HELPERS.getOrCreateSheet('Rule Settings - Campaign')
      .getRange(1, 1, campaignValues.length, campaignValues[0].length)
      .setValues(campaignValues);
    HELPERS.getOrCreateSheet('Rule Settings - Insertion Order')
      .getRange(1, 1, ioValues.length, ioValues[0].length)
      .setValues(ioValues);
  },
  '1.2': () => {
    // encrypt rules
    const properties = PropertiesService.getScriptProperties().getProperties();
    const newProperties = { ...properties };
    for (const [key, property] of Object.entries(properties)) {
      if (
        [
          'pacingDays',
          'impressionsByGeo',
          'pacingPercent',
          'dailyBudget',
          'geo',
        ].indexOf(key.split('-')[0]) < 0
      ) {
        continue;
      }
      if (!property.startsWith('{')) {
        continue;
      }
      newProperties[key] = Utilities.gzip(
        Utilities.newBlob(property),
      ).getDataAsString();
    }
    PropertiesService.getScriptProperties().setProperties(newProperties);
  },
  '1.3': () => {
    const active = SpreadsheetApp.getActive();
    if (active.getRangeByName(REPORT_LABEL)) {
      return;
    }
    const sheet = HELPERS.getOrCreateSheet('General/Settings');
    const range = sheet.getRange('A6:C7');
    HELPERS.insertRows(range);
    const reportLabel = sheet.getRange('B6:C6').merge();
    const driveId = sheet.getRange('B7:C7').merge();
    active.setNamedRange(REPORT_LABEL, reportLabel);
    active.setNamedRange(DRIVE_ID, driveId);

    addSettingWithDescription(sheet, 'A6', [
      'Report Label',
      'A human readable label for exported reports\n(e.g. customer name)',
    ]);
    addSettingWithDescription(sheet, 'A7', [
      'Drive ID',
      "The ID of the Drive folder destination\n(copy in folder URL after '/folders/' and before the '?')",
    ]);
  },
  '2.1': (frontend) => {
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Rule Settings - Campaign',
    );
    if (!sheet) {
      return;
    }
    const ruleRange = new RuleRange(
      sheet.getDataRange().getValues(),
      frontend.client,
    );
    const values = ruleRange.getValues();
    const headers = values[2];
    if (!headers) {
      return;
    }
    const geoTargetIndex = headers.findIndex((c) => c === 'Geo Targets');
    if (geoTargetIndex === -1) {
      return;
    }
    headers[geoTargetIndex] = 'Allowed Geo Targets';
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  },
  '2.2.0': () => {
    const active = SpreadsheetApp.getActive();
    if (active.getRangeByName(EXPORT_SETTINGS)) {
      return;
    }
    const sheet = HELPERS.getOrCreateSheet('General/Settings');
    const range = sheet.getRange('A8:C8');
    HELPERS.insertRows(range);
    const exportSettings = sheet.getRange('B8:C8').merge();
    active.setNamedRange(EXPORT_SETTINGS, exportSettings);

    addSettingWithDescription(sheet, 'A8', [
      'Export Settings',
      'Whether to export to Drive, BigQuery, or both.',
    ]);
    exportSettings.setValue('drive');
  },
};
