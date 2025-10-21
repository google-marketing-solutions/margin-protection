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
  RuleExecutor,
  RuleExecutorClass,
  RuleGetter,
  Value,
} from 'common/types';
import { runMigrations } from './migrations/runner';

/**
================================================================================
*
* The base front-end for UIs. This is extensible for customer use-cases.
*/
export abstract class BaseFrontend<T extends ClientTypes<T>> {
  readonly client: T['client'];
  readonly rules: ReadonlyArray<RuleExecutorClass<T>>;

  /**
   * @param category The type of Launch Monitor this is (e.g. SA360, DV360)
   * @param injectedArgs Customizations from the client declaration of Frontend.
   */
  protected constructor(
    private readonly category: string,
    private readonly injectedArgs: FrontendArgs<T> & MigrationArgs<T>,
  ) {
    const clientArgs = this.getIdentity();
    if (!clientArgs) {
      throw new Error('Cannot initialize front-end without client ID(s)');
    }
    this.client = injectedArgs.clientInitializer(
      clientArgs,
      injectedArgs.properties,
    );
    this.rules = injectedArgs.rules;
  }

  /**
   * Creates the sheets for the spreadsheet if they don't exist already.
   */
  async initializeRules() {
    // Implementation to be filled in
  }

  /** Adds the validation at the desired column. */
  abstract addValidation(
    sheet: unknown, // Platform-specific sheet object
    param: Pick<ParamDefinition, 'validationFormulas' | 'numberFormat'>,
    column: number,
  ): void;

  abstract getIdentity(): T['clientArgs'] | null;

  /**
   * Runs rules for all campaigns/insertion orders and returns a scorecard.
   */
  async preLaunchQa() {
    // Implementation to be filled in
  }

  /**
   * Runs an hourly, tracked validation stage.
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
   * Validates settings sheets exist and that they are up-to-date.
   */
  async initializeSheets() {
    if (!this.getIdentity()) {
      throw new Error(
        'No identity set - please go to General/Configuration and fill in required fields.',
      );
    }

    this.migrate();

    await this.initializeRules();
  }

  /**
   * Add a rule sheet with enable/disable checks.
   */
  abstract setUpRuleSheet(): Array<[key: string, enabled: boolean]>;

  /**
   * Handle migrations.
   */
  migrate(): number {
    return runMigrations({
      properties: this.injectedArgs.properties,
      legacyMigrations: this.injectedArgs.legacyMigrations ?? {},
      migrations: this.injectedArgs.migrations,
      platform: this.category,
      currentAppVersion: this.injectedArgs.version,
      frontend: this as unknown as T['frontend'],
    });
  }

  abstract maybeSendEmailAlert(rules: Record<string, RuleGetter>): void;

  abstract sendEmailAlert(rules: RuleGetter[], message: unknown): void;

  protected abstract saveSettingsBackToSheets(
    rules: Array<RuleExecutor<T>>,
  ): void;

  abstract populateRuleResultsInSheets(
    rules: Record<string, RuleExecutor<T>>,
    results: Record<string, ExecutorResult>,
  ): void;
}
