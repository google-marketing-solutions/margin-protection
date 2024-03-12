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
 * @fileoverview frontend/apps script hooks for SA360 launch monitor
 */

// g3-format-prettier

import {
  AppsScriptFrontEnd,
  AppsScriptPropertyStore,
  RULE_SETTINGS_SHEET,
  addSettingWithDescription,
  getOrCreateSheet,
  getTemplateSetting,
} from 'common/sheet_helpers';
import {
  FrontEndArgs,
  ParamDefinition,
  RuleExecutor,
} from 'common/types';
import {RuleRange} from 'sa360/src/client';
import {
  ClientArgs,
  ClientArgsV2,
  ClientInterface,
  ClientInterfaceV2,
  RuleGranularity,
} from 'sa360/src/types';

/**
 * The name of the general settings sheet.
 */
export const GENERAL_SETTINGS_SHEET = 'General/Settings';

/**
 * The name of the label range in Apps Script.
 */
export const LABEL_RANGE = 'LABEL';

/**
 * The name of the email list range in Apps Script.
 */
export const EMAIL_LIST_RANGE = 'EMAIL_LIST';

// NEW SA360 API variables
const LOGIN_CUSTOMER_ID = 'LOGIN_CUSTOMER_ID';
const CUSTOMER_IDS = 'CUSTOMER_IDS';

// OLD SA360 API variables
const AGENCY_ID = 'AGENCY_ID';
const ADVERTISER_ID = 'ADVERTISER_ID';

// Common variables
const DRIVE_ID_RANGE = 'DRIVE_ID';
const FULL_FETCH_RANGE = 'FULL_FETCH';

/**
 * A list of migrations with version as key and a migration script as the
 * value.
 */
export const migrations: Record<string, (frontend: SearchAdsFrontEnd) => void> =
  {
    '1.1': (frontend) => {
      const active = SpreadsheetApp.getActive();
      const ruleSettingsSheet = active.getSheetByName(RULE_SETTINGS_SHEET);
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
      ioValues = ruleRange.getValues(RuleGranularity.AD_GROUP);
      active.deleteSheet(ruleSettingsSheet);
      getOrCreateSheet('Rule Settings - Campaign')
        .getRange(1, 1, campaignValues.length, campaignValues[0].length)
        .setValues(campaignValues);
      getOrCreateSheet('Rule Settings - Insertion Order')
        .getRange(1, 1, ioValues.length, ioValues[0].length)
        .setValues(ioValues);
    },
    '1.2': (frontend) => {
      const active = SpreadsheetApp.getActive();
      const generalSettingsSheet = active.getSheetByName(
        GENERAL_SETTINGS_SHEET,
      );
      if (!generalSettingsSheet) {
        return;
      }
      const emailList = active.getRangeByName(EMAIL_LIST_RANGE);
      if (emailList) {
        return;
      }
      const range = generalSettingsSheet
        .getRange('A6:C7')
        .insertCells(SpreadsheetApp.Dimension.ROWS);
      range.setValues([
        ['Report Label (e.g. Customer)', '', ''],
        ['Comma Separated List of Emails', '', ''],
      ]);
      active.setNamedRange(
        LABEL_RANGE,
        generalSettingsSheet.getRange('B6:C6').merge(),
      );
      active.setNamedRange(
        EMAIL_LIST_RANGE,
        generalSettingsSheet.getRange('B7:C7').merge(),
      );
    },
    '1.3': (frontend) => {
      const active = SpreadsheetApp.getActive();
      const generalSettingsSheet = active.getSheetByName(
        GENERAL_SETTINGS_SHEET,
      );
      if (!generalSettingsSheet) {
        return;
      }
      const driveIdRange = active.getRangeByName(DRIVE_ID_RANGE);
      if (driveIdRange) {
        return;
      }
      generalSettingsSheet
        .getRange('A8:C8')
        .insertCells(SpreadsheetApp.Dimension.ROWS);
      addSettingWithDescription(generalSettingsSheet, 'A8', [
        'Reporting - Google Drive Folder ID',
        "The ID of the Drive folder destination\n(copy in folder URL after '/folders/' and before the '?')",
      ]);
      active.setNamedRange(
        DRIVE_ID_RANGE,
        generalSettingsSheet.getRange('B8:C8').merge(),
      );
    },
    '1.4': (frontend) => {
      const active = SpreadsheetApp.getActive();
      const generalSettingsSheet = active.getSheetByName(
        GENERAL_SETTINGS_SHEET,
      );
      if (!generalSettingsSheet) {
        return;
      }
      const properties: Array<[key: string, value: string]> = Object.entries(
        frontend.client.properties.getProperties(),
      );
      for (const [propName, property] of properties) {
        if (
          propName.startsWith('adGroupTargetChange') ||
          propName.startsWith('locationChange')
        ) {
          const rule = JSON.parse(property) as Record<
            string,
            {
              value: string;
              internal: {original: Record<string, Record<string, string>>};
            }
          >;
          for (const key of Object.keys(rule)) {
            rule[key].value = rule[key].value
              .split(', ')
              .map((r) => {
                const parts = r.split(':');
                return `${parts[0]}:${parts[2]}`;
              })
              .join(', ');
            for (const [origKey, origVal] of Object.entries(
              rule[key].internal.original,
            )) {
              rule[key].internal.original[origKey] = Object.fromEntries(
                Object.entries(origVal).map(([k, v]) => {
                  return [
                    k.split(':')[1],
                    v.replace(/\+(-?\d+(\.\d+)?)%/, '$1'),
                  ];
                }),
              );
            }
          }
          frontend.client.properties.setProperty(
            propName,
            JSON.stringify(rule),
          );
        }
      }
    },
    '2.0': () => {
      if (!SpreadsheetApp.getActive().getRangeByName(FULL_FETCH_RANGE)) {
        return;
      }
      const properties = new AppsScriptPropertyStore();
      Object.entries(properties.getProperties()).forEach(([k, v]) => {
        properties.setProperty(
          k,
          JSON.stringify({
            values: JSON.parse(v),
            updated: new Date(),
          }),
        );
      });
      const sheet = getOrCreateSheet('General/Settings');
      sheet.getRange('A8:C8').insertCells(SpreadsheetApp.Dimension.ROWS);
      addSettingWithDescription(sheet, 'A8', [
        'Make next report a full run?',
        'Full runs are slower then incremental reports, but should always be run ' +
          'the first time to populate rules. This will get manually set back to ' +
          'FALSE after a run.',
      ]);
      sheet
        .getRange('B8:C8')
        .setValues([['TRUE', '']])
        .merge();
      SpreadsheetApp.getActive().setNamedRange(
        FULL_FETCH_RANGE,
        sheet.getRange('B8'),
      );
    },
  };

/**
 * Migrations for the new SA360 V2 Launch Monitor
 */
export const migrationsV2: Record<
  string,
  (frontend: NewSearchAdsFrontEnd) => void
> = {};

/**
 * Front-end configuration for SA360 Apps Script.
 */
export class SearchAdsFrontEnd extends AppsScriptFrontEnd<
  ClientInterface,
  RuleGranularity,
  ClientArgs,
  SearchAdsFrontEnd
> {
  constructor(
    args: FrontEndArgs<
      ClientInterface,
      RuleGranularity,
      ClientArgs,
      SearchAdsFrontEnd
    >,
  ) {
    super('SA360', args);
  }

  override getIdentity() {
    const sheet = SpreadsheetApp.getActive();
    if (!sheet) {
      throw new Error('There is no active spreadsheet.');
    }
    const agencyId = sheet.getRangeByName(AGENCY_ID);
    const advertiserId = sheet.getRangeByName(ADVERTISER_ID);
    const fullFetch = sheet.getRangeByName(FULL_FETCH_RANGE);
    if (!agencyId) {
      return null;
    }
    const label = sheet.getRangeByName(LABEL_RANGE);
    return {
      agencyId: agencyId.getValue(),
      advertiserId: advertiserId?.getValue(),
      fullFetch: fullFetch?.getValue(),
      label: label?.getValue() || `${advertiserId!.getValue()}`,
    };
  }

  override displaySetupModal() {
    const template = HtmlService.createTemplateFromFile('html/setup');
    template['agencyId'] = this.getRangeByName(AGENCY_ID).getValue() || '';
    template['advertiserId'] =
      this.getRangeByName(ADVERTISER_ID).getValue() || '';
    const htmlOutput = template.evaluate().setWidth(350).setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Set up');

    return template['advertiserID'];
  }

  override async preLaunchQa() {
    this.client.args.fullFetch = true;
    await super.preLaunchQa();
  }

  override async initializeSheets() {
    this.client.args.fullFetch = true;
    await super.initializeSheets();
  }

  override saveSettingsBackToSheets(
    rules: Array<
      RuleExecutor<
        ClientInterface,
        RuleGranularity,
        ClientArgs,
        Record<string, ParamDefinition>
      >
    >,
  ) {
    super.saveSettingsBackToSheets(rules);
    getTemplateSetting(FULL_FETCH_RANGE).setValue('FALSE');
    this.client.args.fullFetch = false;
  }
}

/**
 * Front-end configuration for the new SA360 (our V2) Apps Script.
 */
export class NewSearchAdsFrontEnd extends AppsScriptFrontEnd<
  ClientInterfaceV2,
  RuleGranularity,
  ClientArgsV2,
  NewSearchAdsFrontEnd
> {
  constructor(
    args: FrontEndArgs<
      ClientInterfaceV2,
      RuleGranularity,
      ClientArgsV2,
      NewSearchAdsFrontEnd
    >,
  ) {
    super('SA360', args);
  }

  private cleanCid(cid: string | number) {
    return String(cid).replace(/[- ]/, '');
  }

  override getIdentity() {
    const loginCustomerId = this.getValueFromRangeByName({
      name: LOGIN_CUSTOMER_ID,
      allowEmpty: true,
    });
    const customerIdsDirty = this.getValueFromRangeByName({
      name: CUSTOMER_IDS,
      allowEmpty: false,
    });
    const label = this.getValueFromRangeByName({
      name: LABEL_RANGE,
      allowEmpty: true,
    });
    const customerIds = this.cleanCid(customerIdsDirty);

    return {
      loginCustomerId: loginCustomerId
        ? this.cleanCid(loginCustomerId)
        : customerIds,
      customerIds,
      label: String(label || customerIds),
    };
  }

  override displaySetupModal() {
    const template = HtmlService.createTemplateFromFile('html/setup');
    template['agencyId'] = this.getRangeByName(AGENCY_ID).getValue() || '';
    template['advertiserId'] =
      this.getRangeByName(ADVERTISER_ID).getValue() || '';
    const htmlOutput = template.evaluate().setWidth(350).setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Set up');

    return template['advertiserID'];
  }

  override async preLaunchQa() {
    await super.preLaunchQa();
  }

  override async initializeSheets() {
    await super.initializeSheets();
  }

  override saveSettingsBackToSheets(
    rules: Array<
      RuleExecutor<
        ClientInterfaceV2,
        RuleGranularity,
        ClientArgsV2,
        Record<string, ParamDefinition>
      >
    >,
  ) {
    super.saveSettingsBackToSheets(rules);
    getTemplateSetting(FULL_FETCH_RANGE).setValue('FALSE');
    this.client.args.fullFetch = false;
  }
}
