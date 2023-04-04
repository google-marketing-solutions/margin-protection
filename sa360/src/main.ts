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

/**
 * @fileoverview Apps Script handlers.
 */

import {getRule, Value, Values} from 'anomaly_library/main';
import {Client, RuleExecutorClass, RuleRange} from 'sa360/src/client';
import {campaignStatusRule, adGroupStatusRule, adGroupTargetRule} from 'sa360/src/rules';
import {ParamDefinition, RuleGranularity} from 'common/types';

import Sheet = GoogleAppsScript.Spreadsheet.Sheet;
import {getOrCreateSheet} from 'common/sheet_helpers';
import {ClientArgs} from 'sa360/src/types';

/**
 * The name of the settings sheet (before granularity).
 */
export const RULE_SETTINGS_SHEET = 'Rule Settings';

/**
 * The sheet version the app currently has.
 *
 * This is used to manage migrations from one version of Launch Monitor to
 * another.
 */
export const CURRENT_SHEET_VERSION = 1.1;

const FOLDER = 'application/vnd.google-apps.folder';

/**
 * A list of rules that should be run and checked.
 *
 * Comment/uncomment rules here to disable/enable them, respectively.
 */
export const ENABLED_RULES: Array<RuleExecutorClass<Record<string, ParamDefinition>>> = [
    campaignStatusRule,
    adGroupStatusRule,
    adGroupTargetRule,
];

/**
 * The primary interface.
 *
 * Schedule this function using `client.launchMonitor()` at your preferred cadence.
 */
export function onOpen() {
  const subMenus: Array<{name: string, functionName: string}> = [
    {name: 'Sync Campaigns', functionName: 'initializeSheets'},
    {name: 'Pre-Launch QA', functionName: 'preLaunchQa'},
  ];
  SpreadsheetApp.getActive().addMenu('SA360 Launch Monitor', subMenus);
}

/**
 * Creates the sheets for the spreadsheet if they don't exist already.
 *
 * If they do exist, merges data from the existing and adds any new rules
 * that aren't already there.
 */
export async function initializeRules(client: Client) {
  const numberOfHeaders = 3;

  const sheets = ENABLED_RULES.reduce((prev, rule) => {
    (prev[rule.definition.granularity.toString()] ??= [] as Array<RuleExecutorClass<Record<string, ParamDefinition>>>)
        .push(rule);
    return prev;
  }, {} as Record<string, Array<RuleExecutorClass<Record<string, ParamDefinition>>>>);

  for (const [sheetName, ruleClasses] of Object.entries(sheets)) {
    const ruleSheet = getOrCreateSheet(`${RULE_SETTINGS_SHEET} - ${sheetName}`);
    ruleSheet.getRange('A:Z').clearDataValidations();
    const rules = new RuleRange(ruleSheet.getDataRange().getValues(), client);
    let currentOffset = numberOfHeaders + 1; // includes campaignID and campaign name (1-based index).
    const offsets: Record<string, number> = {};

    for (const rule of ruleClasses) {
      await rules.fillRuleValues(rule.definition);
      const ruleValues = rules.getRule(rule.definition.name);
      client.addRule(
          rule,
          ruleValues ,
      );
      offsets[rule.definition.name] = currentOffset - 1;
      currentOffset += ruleValues[0].length - 1;
    }
    const values = rules.getValues();
    ruleSheet.clear();
    ruleSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    for (const rule of ruleClasses) {
      Object.values(rule.definition.params).forEach((param, idx) => {
        addValidation(ruleSheet, param, offsets[rule.definition.name] + idx);
      });
    }
    ruleSheet.getBandings().forEach(b => { b.remove() });
    ruleSheet.getDataRange().breakApart();
    ruleSheet.getDataRange().applyRowBanding(SpreadsheetApp.BandingTheme.BLUE);

    let lastStart = 3;
    for (const offset of Object.values(offsets)) {
      if (offset > lastStart) {
        ruleSheet.getRange(1, lastStart, 1, offset - lastStart).merge();
        ruleSheet.getRange(2, lastStart, 1, offset - lastStart).merge();
        lastStart = offset;
      }
    }
  }
}

/** Adds the validation at the desired column. */
function addValidation(sheet: Sheet, {validationFormulas, numberFormat}: Pick<ParamDefinition, 'validationFormulas'|'numberFormat'>, column: number) {
  if (!validationFormulas || !validationFormulas.length) {
    return;
  }
  const validationBuilder = SpreadsheetApp.newDataValidation();
  for (const validationFormula of validationFormulas) {
    validationBuilder.requireFormulaSatisfied(validationFormula);
  }
  const range = sheet.getRange(4, column, sheet.getLastRow() - 3, 1);
  range.setDataValidation(validationBuilder.build());
  if (numberFormat) {
    range.setNumberFormat(numberFormat);
  }
}

const AGENCY_ID = 'AGENCY_ID';
const ADVERTISER_ID = 'ADVERTISER_ID';

/**
 * Used to set the ID and ID type in the sheet.
 */
function setId(id: number, idType: number) {
  getRangeByName(AGENCY_ID).setValue(id);
  getRangeByName(ADVERTISER_ID).setValue(idType);
}

function getIdentity(): Identity | null {
  const sheet = SpreadsheetApp.getActive();
  if (!sheet) {
    throw new Error('There is no active spreadsheet.');
  }
  const agencyId = sheet.getRangeByName(AGENCY_ID);
  const advertiserId = sheet.getRangeByName(ADVERTISER_ID);
  if (!agencyId) {
    return null;
  }
  return { agencyId: agencyId.getValue(), advertiserId: advertiserId?.getValue() };
}

/**
 * Runs rules for all campaigns/insertion orders and returns a scorecard.
 */
export async function preLaunchQa() {
  const identity = getIdentity();
  if (!identity) {
    throw new Error('Missing Advertiser ID - Please fill this out before continuing.');
  }

  const report: {[rule: string]: {[campaignId: string]: Value}} = {};
  const client = ClientHolder.getClient();
  await initializeRules(client);
  const thresholds: Array<[string, Promise<{values: Values}>]> = Object.values(client.ruleStore).map((rule) => {
    return [rule.name, rule.run()];
  });

  for (const [ruleName, threshold] of thresholds) {
    const {values} = await threshold;

    for (const value of Object.values(values)) {
      const fieldKey = Object.entries(value.fields ?? [['', 'all']]).map(([key, value]) => key ? `${key}: ${value}` : '').join(', ');
      report[ruleName] = report[ruleName] || {};
      // overwrite with the latest `Value` until there's nothing left.
      report[ruleName][fieldKey] = value;
    }
  }

  const sheet = getOrCreateSheet('Pre-Launch QA Results');
  const lastUpdated = [`Last Updated ${new Date(Date.now()).toISOString()}`, '', '', ''];
  const headers = ['Rule', 'Field', 'Value', 'Anomaly'];
  const valueArray = [
    lastUpdated,
    headers,
    ...Object.entries(report).flatMap(([key, values]): string[][] => {
      return Object.entries(values).map(([fieldKey, value]): string[]  => {
            return [key, fieldKey, String(value.value), String(value.anomalous)];
          },
      );
    }),
  ];
  sheet.getRange('A:Z').clearDataValidations();
  sheet.clear();
  sheet.getRange(1, 1, valueArray.length, valueArray[0].length).setValues(valueArray);
}

/**
 * Runs an hourly, tracked validation stage.
 *
 * This should be run on a schedule. It's intentionally not exposed to the
 * UI as a menu because it would interfere with the scheduled runs.
 */
export async function launchMonitor() {
  await initializeSheets();
  const client = ClientHolder.getClient();
  await initializeRules(client);
  await client.validate();
  populateRuleResultsInSheets(client);
}

/**
 * Given an array of rules, returns a 2-d array representation.
 */
export function getMatrixOfResults(valueLabel: string, values: Value[]): string[][] {

  const headers = Object.keys(values[0]);
  const matrix = [[valueLabel, headers[1], ...Object.keys(values[0].fields || {}).map(String)]];
  for (const value of values) {
    const row = Object.values(value);
    matrix.push([...row.slice(0, 2).map(String), ...Object.values(row[2] || []).map(String)]);
  }
  return matrix;
}

/**
 * Converts a 2-d array to a CSV.
 *
 * Exported for testing.
 */
export function matrixToCsv(matrix: string[][]): string {
  // note - the arrays we're using get API data, not user input. Not anticipating
  // anything that complicated, but we're adding tests to be sure.
  return matrix.map(row => row.map(col => `"${col.replaceAll('"', '"""')}"`).join(',')).join('\n');
}

/**
 * Exports rules as a CSV.
 *
 */
export function exportAsCsv(ruleName: string, matrix: string[][]) {
  const file = Utilities.newBlob(matrixToCsv(matrix));
  const folder = getOrCreateFolder('launch_monitor');
  const filename = `${ruleName}_${new Date(Date.now()).toISOString()}`;
  Drive.Files!.insert({parents: [{id: folder}], title: `${filename}.csv`, mimeType: 'text/plain'}, file);
  console.log(`Exported CSV launch_monitor/${filename} to Google Drive`);
}

function getOrCreateFolder(folderName: string) {
  const folders = Drive.Files!.list({q: `title="launch_monitor" and mimeType="${FOLDER}" and not trashed`}).items;
  let folder;
  if (folders && folders.length) {
    folder = folders[0].id;
  } else {
    folder = Drive.Files!.insert({title: 'launch_monitor', mimeType: FOLDER}).id;
  }
  console.log('folder', folder);
  return folder;
}

function populateRuleResultsInSheets(client: Client) {
  for (const rule of Object.values(client.ruleStore)) {
    const sheet = getOrCreateSheet(`${rule.name} - Results`);
    const uniqueKey = rule.getUniqueKey();
    const values = Object.values(getRule(uniqueKey).getValues());
    if (values.length < 1) {
      console.warn(`No rules for ${uniqueKey}`);
      continue;
    }
    const unfilteredMatrix = getMatrixOfResults(rule.valueFormat.label, values);
    const matrix = unfilteredMatrix.filter(
        row => row.length === Object.keys(rule.params).length);
    if (matrix.length !== unfilteredMatrix.length) {
      console.error(`Dropped ${unfilteredMatrix.length - matrix.length} malformed records.`);
    }
    sheet.clear();
    sheet.getRange(1, 1, matrix.length, matrix[0].length).setValues(matrix);
    if (rule.valueFormat.numberFormat) {
      sheet.getRange(2, 1, matrix.length - 1, 1)
          .setNumberFormat(rule.valueFormat.numberFormat);
    }
    if (getTemplateSetting('LAUNCH_MONITOR_OPTION').getValue() === 'CSV Back-Up') {
      exportAsCsv(rule.name, matrix);
    }
  }
}

class Identity {
  constructor(readonly agencyId: string, readonly advertiserId?: string) {}
}

/**
 * Provides a Singleton clientID for required identity.
 */
export class ClientHolder {
  private static instance: ClientHolder;
  private readonly client: Client;

  private constructor(options: ClientArgs) {
    this.client = new Client(options);
  }

  static getClient(identity = getIdentity()): Client {
    if (!identity) {
      throw new Error('Missing agency ID. Cannot initialize.');
    }
    if (!ClientHolder.instance) {
      ClientHolder.instance = new ClientHolder(identity);
    }
    return ClientHolder.instance.getClient();
  }

  getClient() {
    return this.client;
  }
}

function getRangeByName(name: string) {
  const range = SpreadsheetApp.getActive().getRangeByName(name);
  if (!range) {
    throw new Error(`Missing an expected range '${name}'. You may need to get a new version of this sheet from the template.`);
  }

  return range;
}

function displaySetupModal() {
  const template = HtmlService.createTemplateFromFile('html/setup');
  template['agencyId'] = getRangeByName(AGENCY_ID).getValue() || '';
  template['advertiserId'] = getRangeByName(ADVERTISER_ID).getValue() || '';
  const htmlOutput = template.evaluate()
      .setWidth(350)
      .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Set up');
}

/**
 * Validates settings sheets exist and that they are up-to-date.
 */
export async function initializeSheets() {
  if (!getIdentity()) {
    let advertiserId = '';

    while (!advertiserId) {
      displaySetupModal();
    }
    getTemplateSetting('ID').setValue(advertiserId);
  }

  const client = ClientHolder.getClient();
  migrate(client);
  await initializeRules(client);
}

function getTemplateSetting(rangeName: string) {
  const range = SpreadsheetApp.getActive().getRangeByName(rangeName);
  if (!range) {
    throw new Error(`The sheet has an error. A named range '${rangeName}' that should exist does not.`);
  }

  return range;
}

/**
 * A list of migrations with version as key and a migration script as the value.
 */
export const migrations: Record<number, (client: Client) => void> = {
  '1.1': (client: Client) => {
    const active = SpreadsheetApp.getActive();
    const ruleSettingsSheet = active.getSheetByName('Rule Settings');
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
};

/**
 * Handle migrations for Google Sheets (sheets getting added/removed).
 */
export function migrate(client: Client): number {
  const sheetVersion = Number(PropertiesService.getScriptProperties().getProperty('sheet_version'));
  let numberOfMigrations = 0;
  if (!sheetVersion) {
    PropertiesService.getScriptProperties().setProperty('sheet_version', String(CURRENT_SHEET_VERSION));
  }

  for (const [version, migration] of Object.entries(migrations)) {
    if (Number(version) > sheetVersion) {
      migration(client);
      // write manually each time because we want incremental migrations if
      // anything fails.
      PropertiesService.getScriptProperties().setProperty(
          'sheet_version', version);
      ++numberOfMigrations;
    }
  }
  if (sheetVersion !== CURRENT_SHEET_VERSION) {
    PropertiesService.getScriptProperties().setProperty(
        'sheet_version', String(CURRENT_SHEET_VERSION));
  }
  return numberOfMigrations;
}

global.onOpen = onOpen;
global.initializeSheets = initializeSheets;
global.preLaunchQa = preLaunchQa;
global.launchMonitor = launchMonitor;
