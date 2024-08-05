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

/**
 * @fileoverview frontend/apps script hooks for DV360 launch monitor
 */

// g3-format-prettier

import {
  AppsScriptFrontend,
  AppsScriptPropertyStore,
  HELPERS,
  LABEL_RANGE,
  addSettingWithDescription,
  getOrCreateSheet,
} from 'common/sheet_helpers';
import { FrontendArgs } from 'common/types';
import { RuleRange } from 'dv360/src/client';
import { ClientArgs, ClientInterface } from 'dv360/src/types';

import { IDType, RuleGranularity } from './types';

const ENTITY_ID = 'ENTITY_ID';
const ID_TYPE = 'ID_TYPE';

/**
 * The name of the general settings sheet.
 */
export const GENERAL_SETTINGS_SHEET = 'General/Settings';

/**
 * A list of migrations with version as key and a migration script as the
 * value.
 */
export const migrations: Record<
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
    getOrCreateSheet('Rule Settings - Campaign')
      .getRange(1, 1, campaignValues.length, campaignValues[0].length)
      .setValues(campaignValues);
    getOrCreateSheet('Rule Settings - Insertion Order')
      .getRange(1, 1, ioValues.length, ioValues[0].length)
      .setValues(ioValues);
  },
  '1.2': (frontend) => {
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
    const sheet = getOrCreateSheet('General/Settings');
    const range = sheet.getRange('A6:C7');
    HELPERS.insertRows(range);
    const reportLabel = sheet.getRange('B6:C6').merge();
    const driveId = sheet.getRange('B7:C7').merge();
    active.setNamedRange('REPORT_LABEL', reportLabel);
    active.setNamedRange('DRIVE_ID', driveId);

    addSettingWithDescription(sheet, 'A6', [
      'Report Label',
      'A human readable label for exported reports\n(e.g. customer name)',
    ]);
    addSettingWithDescription(sheet, 'A7', [
      'Drive ID',
      "The ID of the Drive folder destination\n(copy in folder URL after '/folders/' and before the '?')",
    ]);
  },
  '2.0': () => {
    const properties = new AppsScriptPropertyStore();
    Object.entries(properties.getProperties()).forEach(([k, v]) => {
      properties.setProperty(
        k,
        JSON.stringify({ values: JSON.parse(v), updated: new Date() }),
      );
    });
  },
};

/**
 * Front-end configuration for DV360 Apps Script.
 */
export class DisplayVideoFrontend extends AppsScriptFrontend<
  ClientInterface,
  RuleGranularity,
  ClientArgs,
  DisplayVideoFrontend
> {
  constructor(
    args: FrontendArgs<
      ClientInterface,
      RuleGranularity,
      ClientArgs,
      DisplayVideoFrontend
    >,
  ) {
    super('DV360', args);
  }

  override getIdentity() {
    const sheet = SpreadsheetApp.getActive();
    if (!sheet) {
      throw new Error('There is no active spreadsheet.');
    }
    const label = sheet.getRangeByName(LABEL_RANGE);
    const idRange = sheet.getRangeByName(ENTITY_ID);
    const idTypeRange = sheet.getRangeByName(ID_TYPE);
    if (!idRange || !idTypeRange) {
      return null;
    }
    const idType = idTypeRange.getValue();
    return {
      id: idRange.getValue(),
      idType: idType === 'Advertiser' ? IDType.ADVERTISER : IDType.PARTNER,
      label: label?.getValue() || `${idType} ${idRange.getValue()}`,
      name: label?.getValue(),
    };
  }

  override displaySetupModal() {
    const template = HtmlService.createTemplateFromFile('html/setup');
    template['id'] = this.getRangeByName(ENTITY_ID).getValue() || '';
    template['idType'] = this.getRangeByName(ID_TYPE).getValue() || '';
    const htmlOutput = template.evaluate().setWidth(350).setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Set up');
    return template['id'];
  }
}
