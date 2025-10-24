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
  ClientTypes,
  ExecutorResult,
  FrontendArgs,
  MigrationArgs,
  ParamDefinition,
  PropertyStore,
  RuleExecutor,
  RuleExecutorClass,
  RuleGetter,
  Value,
  Values,
} from '#common/types.js';
import { runMigrations } from '#common/migrations/runner.js';
import { EMAIL_LIST_RANGE, FOLDER, RULE_SETTINGS_SHEET } from './constants.js';
import { getTemplateSetting, HELPERS } from './helpers.js';
import { emailAlertBody } from './email.js';
import { ExportContext, ExportOptions } from '../exporter.js';
import { BigQueryStrategyExporter } from '../exporters/bigquery_exporter.js';
import { DriveExporter } from '../exporters/drive_exporter.js';

/**
 * The front-end for Apps Script UIs. This is extensible for customer use-cases.
 *
 * The easiest approach to modifying this is to handle changes in {@link injectedArgs}.
 * It is also possible to extend this class for more in-depth changes.
 */
export abstract class AppsScriptFrontend<T extends ClientTypes<T>> {
  client!: T['client'];
  readonly rules: ReadonlyArray<RuleExecutorClass<T>>;

  /**
   * @param category The type of Launch Monitor this is (e.g. SA360, DV360)
   * @param injectedArgs Customizations from the client declaration of Frontend.
   */
  protected constructor(
    private readonly category: string,
    private readonly injectedArgs: FrontendArgs<T> & MigrationArgs<T>,
  ) {
    this.rules = injectedArgs.rules;
  }

  initialize() {
    const clientArgs = this.getIdentity();
    if (!clientArgs) {
      throw new Error('Cannot initialize front-end without client ID(s)');
    }
    this.client = this.injectedArgs.clientInitializer(
      clientArgs,
      this.injectedArgs.properties,
    );
  }

  /**
   * The primary interface.
   *
   * Schedule this function using `client.launchMonitor()` at your preferred
   * cadence.
   */
  async onOpen() {
    SpreadsheetApp.getUi()
      .createMenu('Launch Monitor')
      .addItem('Fetch Data', 'initializeSheets')
      .addItem('Pre-Launch QA', 'preLaunchQa')
      .addItem('Show Glossary', 'displayGlossary')
      .addItem('Settings', 'displaySetupGuide')
      .addToUi();
  }

  /**
   * Creates the sheets for the spreadsheet if they don't exist already.
   *
   * If they do exist, merges data from the existing and adds any new rules
   * that aren't already there.
   */
  async initializeRules() {
    const numberOfHeaders = 3;

    const sheets: Record<string, Array<RuleExecutorClass<T>>> = {};
    for (const rule of this.injectedArgs.rules) {
      (sheets[rule.definition.granularity.toString()] ??= []).push(rule);
    }

    for (const [sheetName, ruleClasses] of Object.entries(sheets)) {
      const ruleSheet = HELPERS.getOrCreateSheet(
        `${RULE_SETTINGS_SHEET} - ${sheetName}`,
      );
      ruleSheet.getRange('A:Z').clearDataValidations();
      const rules = new this.injectedArgs.ruleRangeClass(
        ruleSheet.getDataRange().getValues(),
        this.client,
      );
      let currentOffset = numberOfHeaders + 1; // includes campaignID and campaign name (1-based index).
      const offsets: Record<string, number> = {};

      for (const rule of ruleClasses) {
        await rules.fillRuleValues(rule.definition);
        const ruleValues = rules.getRule(rule.definition.name);
        this.client.addRule(rule, ruleValues);
        offsets[rule.definition.name] = currentOffset - 1;
        currentOffset += ruleValues[0].length - 1;
      }
      const values = rules.getValues();
      ruleSheet.clear();
      if (ruleSheet.getMaxRows() > values.length + 1) {
        ruleSheet.deleteRows(
          values.length + 1,
          ruleSheet.getMaxRows() - (values.length + 1),
        );
      }
      if (ruleSheet.getMaxColumns() > values[0].length + 1) {
        ruleSheet.deleteColumns(
          values[0].length + 1,
          ruleSheet.getMaxColumns() - (values[0].length + 1),
        );
      }
      ruleSheet
        .getRange(1, 1, values.length, values[0].length)
        .setValues(values);
      SpreadsheetApp.flush();
      for (const rule of ruleClasses) {
        Object.values(rule.definition.params).forEach((param, idx) => {
          this.addValidation(
            ruleSheet,
            param,
            offsets[rule.definition.name] + idx,
          );
        });
      }
      ruleSheet.getBandings().forEach((b) => {
        b.remove();
      });
      ruleSheet.getDataRange().breakApart();
      ruleSheet
        .getDataRange()
        .applyRowBanding(SpreadsheetApp.BandingTheme.BLUE);

      let lastStart = 3;
      for (const offset of Object.values(offsets)) {
        if (offset > lastStart) {
          ruleSheet.getRange(1, lastStart, 1, offset - lastStart).merge();
          ruleSheet.getRange(2, lastStart, 1, offset - lastStart).merge();
          lastStart = offset;
        }
      }
    }
    const enabledObject = this.setUpRuleSheet();
    for (const [key, enabled] of enabledObject) {
      this.client.ruleStore[key].enabled = enabled;
    }
  }

  /** Adds the validation at the desired column. */
  addValidation(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    {
      validationFormulas,
      numberFormat,
    }: Pick<ParamDefinition, 'validationFormulas' | 'numberFormat'>,
    column: number,
  ) {
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

  abstract getIdentity(): T['clientArgs'] | null;

  getIdentityFields(): Record<string, { label: string; value: string }> {
    return {};
  }

  protected getIdentityFieldValue(rangeName: string) {
    const spreadsheet = SpreadsheetApp.getActive();
    if (!spreadsheet) {
      return '';
    }
    const range = spreadsheet.getRangeByName(rangeName);
    if (!range) {
      return '';
    }
    return range.getValue() || '';
  }

  /**
   * Runs rules for all campaigns/insertion orders and returns a scorecard.
   */
  async preLaunchQa() {
    type Rule = RuleExecutor<T>;
    const identity = this.getIdentity();
    if (!identity) {
      throw new Error(
        'Missing Advertiser ID - Please fill this out before continuing.',
      );
    }

    const report: { [rule: string]: { [campaignId: string]: Value } } = {};
    await this.initializeSheets();
    const thresholds: Array<[Rule, Promise<{ values: Values }>]> =
      Object.values(this.client.ruleStore)
        .filter((rule) => rule.enabled)
        .map((rule) => {
          return [rule, rule.run()];
        });

    for (const [rule, threshold] of thresholds) {
      if (!rule.enabled) {
        continue;
      }
      const { values } = await threshold;
      for (const value of Object.values(values)) {
        const fieldKey = Object.entries(value.fields ?? [['', 'all']])
          .map(([key, value]) => (key ? `${key}: ${value}` : ''))
          .join(', ');
        report[rule.name] = report[rule.name] || {};
        // overwrite with the latest `Value` until there's nothing left.
        report[rule.name][fieldKey] = value;
      }
    }

    const sheet = HELPERS.getOrCreateSheet('Pre-Launch QA Results');
    const lastUpdated = [
      `Last Updated ${new Date(Date.now()).toISOString()}`,
      '',

      '',
      '',
    ];
    const headers = ['Rule', 'Field', 'Value', 'Anomaly'];
    const valueArray = [
      lastUpdated,
      headers,
      ...Object.entries(report).flatMap(([key, values]): string[][] => {
        return Object.entries(values).map(([fieldKey, value]): string[] => {
          return [key, fieldKey, String(value.value), String(value.anomalous)];
        });
      }),
    ];
    sheet.getRange('A:Z').clearDataValidations();
    sheet.clear();

    sheet
      .getRange(1, 1, valueArray.length, valueArray[0].length)
      .setValues(valueArray);
    HELPERS.applyAnomalyHelper(
      sheet.getRange(2, 1, valueArray.length - 1, valueArray[0].length),
      4,
    );
  }

  /**
   * Runs an hourly, tracked validation stage.
   *
   * This should be run on a schedule. It's intentionally not exposed to the
   * UI as a menu because it would interfere with the scheduled runs.
   */
  async launchMonitor() {
    await this.initializeSheets();
    const { rules, results } = await this.client.validate();
    this.saveSettingsBackToSheets(Object.values(rules));
    this.populateRuleResultsInSheets(rules, results);
    this.maybeSendEmailAlert(
      Object.fromEntries(
        Object.entries(rules).map(([key, ruleInfo]) => [
          key,
          { name: ruleInfo.name, values: results[key].values },
        ]),
      ),
    );
  }

  displayGlossary() {
    const template = HtmlService.createTemplateFromFile('html/glossary');
    template['rules'] = this.getFrontendDefinitions();
    SpreadsheetApp.getUi().showSidebar(template.evaluate());
  }

  displaySetupGuide() {
    this.migrate();
    const template = HtmlService.createTemplateFromFile('html/setup');
    const dynamicFields = this.getIdentityFields();
    template['dynamicFields'] = JSON.stringify(dynamicFields);
    template['settings'] = this.getSettings() || 'null';
    const htmlOutput = template.evaluate().setWidth(450).setHeight(600);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Export Settings');
  }

  /**
   * Handles various inputs from the client-side modal.
   * @param key The action key.
   * @param payload The data payload.
   */
  handleInput(key: string, payload: object) {
    if (key === 'update:settings') {
      const spreadsheet = SpreadsheetApp.getActive();

      const settingsRange = spreadsheet.getRangeByName('SETTINGS');
      if (settingsRange) {
        settingsRange.clearContent();
        settingsRange.setValue(JSON.stringify(payload));
      }
    } else {
      // In the future, other keys could be handled here.
      console.warn(`Unknown key received in handleInput: ${key}`);
    }
  }

  /**
   * Gets the saved settings from script properties.
   * @returns The settings JSON string or null if not found.
   */
  getSettings(): string | null {
    const spreadsheet = SpreadsheetApp.getActive();
    const settingsRange = spreadsheet.getRangeByName('SETTINGS');
    if (!settingsRange) {
      return null;
    }
    return settingsRange.getValue() || null;
  }

  getFrontendDefinitions() {
    return this.rules.map((rule) => rule.definition);
  }

  /**
   * Given an array of rules, returns a 2-d array representation.
   */
  getMatrixOfResults(valueLabel: string, values: Value[]): string[][] {
    const headers = Object.keys(values[0]);
    const matrix = [
      [
        valueLabel,
        headers[1],
        ...Object.keys(values[0].fields || {}).map(String),
      ],
    ];
    for (const value of values) {
      const row = Object.values(value);
      matrix.push([
        ...row.slice(0, 2).map(String),
        ...Object.values(row[2] || []).map(String),
      ]);
    }
    return matrix;
  }

  /**
   * Exports rules as a CSV.
   */
  exportData(ruleName: string, matrix: string[][]) {
    const settingsStr = this.getSettings();
    if (!settingsStr) {
      // Default to Drive if no settings are configured
      new ExportContext(new DriveExporter()).export(matrix, {
        destination: 'drive',
        fileName: `${this.category}_${
          this.getIdentity()?.label
        }_${ruleName}_${HELPERS.getSheetId()}_${new Date().toISOString()}.csv`,
      });
      return;
    }

    const settings = JSON.parse(settingsStr);
    const exportTarget = settings.exportTarget;
    if (!exportTarget) return;

    let exporter;
    let options: ExportOptions;

    if (exportTarget.type === 'bigquery' && exportTarget.config) {
      const config = exportTarget.config;
      exporter = new BigQueryStrategyExporter(
        config.projectId || '',
        config.datasetId || '',
      );
      options = {
        destination: 'bigquery',
        tableName: `${config.tablePrefix || ''}${ruleName}`,
      };
    } else {
      exporter = new DriveExporter();
      options = {
        destination: 'drive',
        fileName: `${this.category}_${
          this.getIdentity()?.label
        }_${ruleName}_${HELPERS.getSheetId()}_${new Date().toISOString()}.csv`,
      };
    }

    new ExportContext(exporter).export(matrix, options);
  }

  /**
   * Creates a folder if it doesn't exist. Optionally adds it to the Drive ID.
   *
   * @param folderName The name of the folder to create or use.
   *   Should be owned by Apps Script.
   */
  getOrCreateFolder(
    folderName: string,
    parent?: GoogleAppsScript.Spreadsheet.Range,
  ): string {
    const driveId: string = parent
      ? parent.getValue().trim()
      : HELPERS.getDriveFolderId();
    if (!driveId) {
      // This case should be covered by the helper, but as a safeguard:
      throw new Error('Could not determine the Google Drive Folder ID.');
    }

    const file = Drive.Files!.get(driveId);
    let parentName = '';
    if (file && file.id) {
      if (file.mimeType !== FOLDER) {
        throw new Error(
          'The selected Google Drive file ID is not a folder. Please delete and/or add a folder ID',
        );
      }
      parentName = file.id;
    }

    const q =
      (parentName ? `'${parentName}' in parents and ` : '') +
      `name="${folderName}" and mimeType="${FOLDER}" and not trashed`;
    const args = {
      q,
    };
    const folders = Drive.Files!.list(args).files;
    let folder: string;
    if (folders && folders.length) {
      folder = folders[0].id as string;
    } else {
      folder = Drive.Files!.create({
        name: folderName,
        mimeType: FOLDER,
        parents: [driveId],
      }).id as string;
    }
    return folder;
  }

  populateRuleResultsInSheets(
    rules: Record<string, RuleExecutor<T>>,
    results: Record<string, ExecutorResult>,
  ) {
    const ruleSheets: string[] = [];
    for (const [uniqueKey, result] of Object.entries(results)) {
      const rule = rules[uniqueKey];
      const ruleSheet = `${rule.name} - Results`;
      ruleSheets.push(rule.name);
      const sheet = HELPERS.getOrCreateSheet(ruleSheet);
      sheet.clear();
      const values = Object.values(result.values).filter(
        (value) => value.anomalous,
      );
      if (!values.length) {
        continue;
      }
      const unfilteredMatrix = this.getMatrixOfResults(
        rule.valueFormat.label,
        values,
      );
      const matrix = unfilteredMatrix.filter(
        (row) => row.length === unfilteredMatrix[0].length,
      );
      if (!matrix.length || !matrix[0].length) {
        continue;
      }
      if (matrix.length !== unfilteredMatrix.length) {
        console.error(
          `Dropped ${unfilteredMatrix.length - matrix.length} malformed records.`,
        );
      }
      sheet.getRange(1, 1, matrix.length, matrix[0].length).setValues(matrix);
      if (rule.valueFormat.numberFormat) {
        sheet
          .getRange(2, 1, matrix.length - 1, 1)
          .setNumberFormat(rule.valueFormat.numberFormat);
      }

      if (
        getTemplateSetting('LAUNCH_MONITOR_OPTION').getValue() === 'CSV Back-Up'
      ) {
        this.exportData(rule.name, matrix);
      }
    }
    if (ruleSheets.length == 0) {
      return;
    }
    HELPERS.getOrCreateSheet('Summary')
      .getRange(1, 1, ruleSheets.length, 2)
      .setValues(
        ruleSheets.map((rule, i) => [
          rule,
          `=COUNTIF(INDIRECT("'" & A${i + 1} & "' - Results'!B:B"), TRUE)`,
        ]),
      );
  }

  /**
   * Validates settings sheets exist and that they are up-to-date.
   */
  async initializeSheets(properties?: PropertyStore) {
    if (!this.getIdentity()) {
      throw new Error(
        'No identity set - please go to General/Configuration and fill in required fields.',
      );
    }

    this.migrate(properties);

    await this.initializeRules();
  }

  /**
   * Add a rule sheet with enable/disable checks.
   *
   * @returns An object mapping rules to their state (enabled/disabled).
   */
  setUpRuleSheet(): Array<[key: string, enabled: boolean]> {
    const sheet = HELPERS.getOrCreateSheet('Enable/Disable Rules');
    const currentValues = sheet.getDataRange().getValues();
    const ENABLED_COLUMN = 3;
    const RULE_INDEX = 0;

    let enabledMap: Record<string, boolean> = {};
    if (currentValues[0] && currentValues[0][0] !== '') {
      const enabledIndex = currentValues[0].findIndex((c) => c === 'Enabled');
      enabledMap = Object.fromEntries(
        currentValues.map((r) => [r[RULE_INDEX], r[enabledIndex]]),
      );
    }
    const regex = new RegExp('</?.*?>', 'g');
    const paras = new RegExp('<p>(.*?)</p>(?!$)', 'g');

    const ruleRows = [
      ['Rule Name', 'Description', 'Enabled'],
      ...Object.entries(this.client.ruleStore).map(([key, rule]) => [
        key,
        rule.description.replaceAll(paras, '$1\n\n').replaceAll(regex, ''),
        enabledMap[key] ?? true,
      ]),
    ];
    sheet
      .getRange(1, 1, ruleRows.length, ruleRows[0].length)
      .setValues(ruleRows);
    sheet
      .getRange(2, ENABLED_COLUMN, ruleRows.length - 1, 1)
      .insertCheckboxes();
    return ruleRows
      .slice(1)
      .map((row) => [row[0] as string, row[2] as boolean]);
  }
  /**
   * Handle migrations for Google Sheets (sheets getting added/removed).
   */
  migrate(properties?: PropertyStore): number {
    return runMigrations({
      properties: properties ?? this.injectedArgs.properties,
      legacyMigrations: this.injectedArgs.legacyMigrations ?? {},
      migrations: this.injectedArgs.migrations,
      platform: this.category,
      currentAppVersion: this.injectedArgs.version,
      frontend: this as unknown as T['frontend'],
    });
  }

  maybeSendEmailAlert(rules: Record<string, RuleGetter>): void {
    const peopleToSend = getTemplateSetting(EMAIL_LIST_RANGE).getValue();
    const label = this.getIdentity()?.label;
    if (!label) {
      throw new Error('Set up sheet before running.');
    }
    const SEND_DATE_KEY = 'email_send_dates';
    const ANOMALY_SEND_DATE_KEY = 'anomaly_send_dates';

    const spreadsheet = SpreadsheetApp.getActive();
    const settingsRange = spreadsheet.getRangeByName('SETTINGS');
    if (!settingsRange) {
      return;
    }
    const settings = JSON.parse(settingsRange.getValue() || '{}');

    const updateTime = Date.now();
    const emailSendDates = settings[SEND_DATE_KEY] || {};
    const anomalySendDates: { readonly [id: string]: number } =
      settings[ANOMALY_SEND_DATE_KEY] || {};
    const newAnomalySendDates: { [id: string]: number } = {};
    let emailSent = false;

    const rulesWithAnomalies: readonly RuleGetter[] = Object.values(rules)
      .map(
        (rule) =>
          ({
            name: rule.name,
            values: Object.fromEntries(
              Object.entries(rule.values).filter(
                ([_, value]) => value.anomalous,
              ),
            ),
          }) as const,
      )
      .filter((anomalies) => Object.keys(anomalies.values).length);

    for (const to of Object.values<string>(
      peopleToSend
        .replace(';', ',')
        .replace(' ', ',')
        .split(',')
        .filter((s) => s),
    )) {
      /**
       * When a recipient has not received the latest anomaly report, flag it.
       */
      const recipientAlerted = ([key, value]: [key: string, value: Value]) => {
        const alertedAt: number | undefined = anomalySendDates[key];
        return (
          value.anomalous &&
          (!alertedAt || alertedAt > (emailSendDates[to] || 0))
        );
      };

      const unsentAnomalies = rulesWithAnomalies
        .map((rule) => ({
          name: rule.name,
          values: Object.fromEntries(
            Object.entries(rule.values).filter(recipientAlerted),
          ),
        }))
        .filter((rule) => Object.keys(rule.values).length);
      if (unsentAnomalies.length === 0) {
        continue;
      }
      this.sendEmailAlert(unsentAnomalies, {
        to,
        subject: `Anomalies found for ${label}`,
      });
      emailSendDates[to] = updateTime;
      emailSent = true;
    }

    // update all anomalous values to the latest send date
    for (const rule of rulesWithAnomalies) {
      for (const key of Object.keys(rule.values)) {
        newAnomalySendDates[key] = emailSent
          ? updateTime
          : anomalySendDates[key];
      }
    }
    settings[ANOMALY_SEND_DATE_KEY] = newAnomalySendDates;
    settings[SEND_DATE_KEY] = emailSendDates;
    settingsRange.clearContent();
    settingsRange.setValue(JSON.stringify(settings));
  }

  /**
   * Generates an e-mail alert, then updates the alertedAt timestamp.
   *
   * Note: This comes with a default message body. If you add your own, then
   * you're responsible for including the anomaly list and avoiding duplication.
   * Because this is user-facing, tests are strongly encouraged.
   */
  sendEmailAlert(
    rules: RuleGetter[],
    message: GoogleAppsScript.Mail.MailAdvancedParameters,
    sendEmail = MailApp.sendEmail,
  ): void {
    if (rules.length === 0) {
      return;
    }
    const alertTime = Date.now();
    let anomalies: Value[] = [];
    const messages: string[] = [];
    for (const rule of rules) {
      const values = rule.values;
      anomalies = Object.values(values);

      if (anomalies.length === 0) {
        continue;
      }
      messages.push(emailAlertBody(rule.name, anomalies));
    }

    message.body =
      'The following errors were found:\n\n' + messages.join('\n\n');
    sendEmail(message);

    for (const anomaly of anomalies) {
      anomaly.alertedAt = alertTime;
    }
  }

  protected saveSettingsBackToSheets(rules: Array<RuleExecutor<T>>) {
    const spreadsheet = SpreadsheetApp.getActive();
    const settingsRange = spreadsheet.getRangeByName('SETTINGS');
    if (!settingsRange) {
      return;
    }
    const settings = JSON.parse(settingsRange.getValue() || '{}');
    for (const rule of rules) {
      settings[rule.name] = rule.settings;
    }
    settingsRange.clearContent();
    settingsRange.setValue(JSON.stringify(settings));
  }
}
