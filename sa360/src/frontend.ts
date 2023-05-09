/**
 * @license
 * Copyright 2023 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {sendEmailAlert} from 'anomaly_library/main';
import {addSettingWithDescription, AppsScriptFrontEnd, getOrCreateSheet, getTemplateSetting, RULE_SETTINGS_SHEET} from 'common/sheet_helpers';
import {ClientArgs, ClientInterface} from 'sa360/src/types';

import {RuleGranularity} from './types';
import {RuleRange} from 'sa360/src/client';

/**
 * The name of the general settings sheet.
 */
export const GENERAL_SETTINGS_SHEET = 'General/Settings';

const AGENCY_ID = 'AGENCY_ID';
const ADVERTISER_ID = 'ADVERTISER_ID';
const EMAIL_LIST_RANGE = 'EMAIL_LIST';
const LABEL_RANGE = 'LABEL';
const DRIVE_ID_RANGE = 'DRIVE_ID';

/**
 * A list of migrations with version as key and a migration script as the
 * value.
 */
export const migrations: Record<number, (client: ClientInterface) => void> = {
  '1.1': (client: ClientInterface) => {
    const active = SpreadsheetApp.getActive();
    const ruleSettingsSheet = active.getSheetByName(RULE_SETTINGS_SHEET);
    if (!ruleSettingsSheet) {
      return;
    }
    let campaignValues: string[][] = [[]];
    let ioValues: string[][] = [[]];

    const ruleRange =
        new RuleRange(ruleSettingsSheet.getDataRange().getValues(), client);
    campaignValues = ruleRange.getValues(RuleGranularity.CAMPAIGN);
    ioValues = ruleRange.getValues(RuleGranularity.AD_GROUP);
    active.deleteSheet(ruleSettingsSheet);
    getOrCreateSheet('Rule Settings - Campaign')
        .getRange(1, 1, campaignValues.length, campaignValues[0].length)
        .setValues(campaignValues);
    getOrCreateSheet('Rule Settings - Insertion Order')
        .getRange(1, 1, ioValues.length, ioValues[0].length)
        .setValues(ioValues);
  },
  '1.2': (client: ClientInterface) => {
    const active = SpreadsheetApp.getActive();
    const generalSettingsSheet = active.getSheetByName(GENERAL_SETTINGS_SHEET);
    if (!generalSettingsSheet) {
      return;
    }
    const emailList = active.getRangeByName(EMAIL_LIST_RANGE);
    if (emailList) {
      return;
    }
    const range = generalSettingsSheet.getRange('A6:C7').insertCells(
        SpreadsheetApp.Dimension.ROWS);
    range.setValues([
      ['Report Label (e.g. Customer)', '', ''],
      ['Comma Separated List of Emails', '', '']
    ]);
    active.setNamedRange(
        LABEL_RANGE,
        generalSettingsSheet.getRange('B6:C6').merge());
    active.setNamedRange(
        EMAIL_LIST_RANGE,
        generalSettingsSheet.getRange('B7:C7').merge());
  },
  '1.3': (client: ClientInterface) => {
    const active = SpreadsheetApp.getActive();
    const generalSettingsSheet = active.getSheetByName(GENERAL_SETTINGS_SHEET);
    if (!generalSettingsSheet) {
      return;
    }
    const driveIdRange = active.getRangeByName(DRIVE_ID_RANGE);
    if (driveIdRange) {
      return;
    }
    const range = generalSettingsSheet.getRange('A8:C8').insertCells(
        SpreadsheetApp.Dimension.ROWS);
    addSettingWithDescription(generalSettingsSheet, 'A8', [
      'Google Drive Folder ID',
      'The ID of the Drive folder destination\n(copy in folder URL after \'/folders/\' and before the \'?\')',
    ]);
    active.setNamedRange(
        DRIVE_ID_RANGE,
        generalSettingsSheet.getRange('B8:C8').merge());
  },
};

/**
 * Front-end configuration for SA360 Apps Script.
 */
export class SearchAdsFrontEnd extends AppsScriptFrontEnd<
    ClientInterface, RuleGranularity, ClientArgs> {
  override getIdentity() {
    const sheet = SpreadsheetApp.getActive();
    if (!sheet) {
      throw new Error('There is no active spreadsheet.');
    }
    const agencyId = sheet.getRangeByName(AGENCY_ID);
    const advertiserId = sheet.getRangeByName(ADVERTISER_ID);
    if (!agencyId) {
      return null;
    }
    return {
      agencyId: agencyId.getValue(),
      advertiserId: advertiserId?.getValue(),
    };
  }

  override displaySetupModal() {
    const template = HtmlService.createTemplateFromFile('html/setup');
    template['agencyId'] = this.getRangeByName(AGENCY_ID).getValue() || '';
    template['advertiserId'] =
        this.getRangeByName(ADVERTISER_ID).getValue() || '';
    const htmlOutput = template.evaluate().setWidth(350).setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Set up');
  }

  maybeSendEmailAlert() {
    const to =
        getTemplateSetting(EMAIL_LIST_RANGE).getValue();
    const label = getTemplateSetting(LABEL_RANGE).getValue();
    sendEmailAlert(
        Object.values(this.client.ruleStore).map(rule => rule.getRule()), {
          to,
          subject: `Anomalies found for ${label}`,
        });
  }
}
