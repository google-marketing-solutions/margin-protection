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

// g3-format-prettier

import { AppsScriptFrontend } from './sheet_helpers';

/**
 * An abstraction for retrieving properties.
 */
export interface PropertyStore {
  setProperty(propertyName: string, value: string): void;
  getProperty(propertyName: string): string | null;
  getProperties(): Record<string, string>;
}

/**
 * The result of a rule executor once the Promise has resolved.
 */
export interface ExecutorResult {
  values: Values;
}

/**
 * A rule callback is created to enable efficient API calls.
 *
 * Typically, wherever possible, rule methods should be used instead, because
 * they enable efficient pooling of API resources.
 */
export type Callback<Params extends Record<keyof Params, ParamDefinition>> =
  () => Promise<ExecutorResult> & ThisType<Params>;

/**
 * Provides a useful data structure to get campaign ID settings.
 *
 * Defaults to the row with campaignId: 'default' if no campaign ID override is
 * set.
 */
export interface SettingMapInterface<
  P extends { [Property in keyof P]: P[keyof P] },
> {
  getOrDefault(id: string): P;

  /**
   * Retrieves a map of values for the ID {@link id}.
   *
   * If it's missing, blank strings.
   */
  get(id: string): P;
  set(id: string, value: P): void;
  entries(): ReadonlyArray<[string, string[]]>;
}

/**
 * Represents a matrix with IDs leading to setting key:value pairs.
 */
export type Settings<Params> = SettingMapInterface<{
  [Property in keyof Params]: Params[keyof Params];
}>;

/**
 * Defines a client object, which is responsible for wrapping.
 */
export interface BaseClientInterface<
  C extends BaseClientInterface<C, G, A>,
  G extends RuleGranularity<G>,
  A extends BaseClientArgs,
> {
  readonly args: A;
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<C, G, A, Record<string, ParamDefinition>>;
  };
  readonly properties: PropertyStore;
  getAllCampaigns(): Promise<RecordInfo[]>;
  validate(): Promise<{
    rules: Record<
      string,
      RuleExecutor<C, G, A, Record<string, ParamDefinition>>
    >;
    results: Record<string, ExecutorResult>;
  }>;

  addRule<Params extends Record<keyof Params, ParamDefinition>>(
    rule: RuleExecutorClass<C, G, A, Params>,
    settingsArray: ReadonlyArray<string[]>,
  ): C;
}

/**
 * Specifies the sheet (user) facing definition of a rule parameter.
 */
export interface ParamDefinition {
  label: string;
  /** A Google-Sheets formula for validating a column, e.g. "=TRUE". */
  validationFormulas?: string[];
  numberFormat?: string;
}

/**
 * Determines how a rule is changed (e.g. at the campaign or ad group level).
 *
 * This includes any and all types of granularity for any and all products.
 * Use the granularity you'd like to appear on your settings page.
 */
export type RuleGranularity<G extends RuleGranularity<G>> = {
  [Property in keyof G]: G;
};

/**
 * Actionable object to run a rule.
 */
export interface RuleExecutor<
  C extends BaseClientInterface<C, G, A>,
  G extends RuleGranularity<G>,
  A extends BaseClientArgs,
  P extends Record<keyof P, ParamDefinition>,
> extends Omit<RuleDefinition<P, G>, 'callback' | 'defaults' | 'granularity'> {
  client: C;
  settings: Settings<Record<keyof P, string>>;
  run: Function;
  helper: string;
  granularity: G;
}

/**
 * Simple information-level data holder for a rule.
 *
 * For more, use the generic {@link RuleDefinition}.
 */
export interface RuleInfo {
  name: string;
  description: string;
}
/**
 * Merger of {@link RuleInfo} and {@link ExecutorResult}.
 */
export interface RuleGetter {
  name: string;
  values: Values;
}

/**
 * An executable rule.
 */
export interface RuleExecutorClass<
  C extends BaseClientInterface<C, G, A>,
  G extends RuleGranularity<G>,
  A extends BaseClientArgs,
  P extends Record<keyof P, P[keyof P]> = Record<string, ParamDefinition>,
> {
  new (client: C, settings: ReadonlyArray<string[]>): RuleExecutor<C, G, A, P>;
  definition: RuleDefinition<P, G>;
}

/**
 * The type-enforced parameters required to create a rule with `newRule`.
 */
export interface RuleDefinition<
  P extends Record<keyof P, ParamDefinition>,
  G extends RuleGranularity<G>,
> extends RuleInfo {
  callback: Callback<P>;
  granularity: G;
  params: { [Property in keyof P]: ParamDefinition };
  defaults: { [Property in keyof P]: string };
  helper?: string;
  /** The name of the "value" column in the anomaly detector, for reporting. */
  valueFormat: { label: string; numberFormat?: string };
}

/**
 * Extracts pertinent information from a campaign.
 */
export interface RecordInfo {
  advertiserId: string;
  id: string;
  displayName: string;
}

/**
 * Record Info for the new SA360.
 *
 * SA360 no longer uses advertiser IDs, instead using customer IDs.
 */
export interface CustomerRecordInfo {
  advertiserId: string;
  id: string;
  displayName: string;
}

/**
 * Represents a client-specific set of client arguments to initialize a client.
 */
export interface BaseClientArgs {
  /**
   * The name of the client. Distinguishable for emails.
   */
  label: string;
}

/**
 * A rule class that can instantiate a {@link RuleExecutor} object.
 */
export interface RuleExecutorClass<
  C extends BaseClientInterface<C, G, A>,
  G extends RuleGranularity<G>,
  A extends BaseClientArgs,
  P extends Record<keyof P, P[keyof P]> = Record<string, ParamDefinition>,
> {
  new (client: C, settings: ReadonlyArray<string[]>): RuleExecutor<C, G, A, P>;
  definition: RuleDefinition<P, G>;
}

/**
 * Contains a `RuleContainer` along with information to instantiate it.
 *
 * This interface enables type integrity between a rule and its settings.
 *
 * This is not directly callable. Use {@link newRule} to generate a
 * {@link RuleExecutorClass}.
 *
 * @param Params a key/value pair where the key is the function parameter name
 *   and the value is the human-readable name. The latter can include spaces and
 *   special characters.
 */
export interface RuleStoreEntry<
  C extends BaseClientInterface<C, G, A>,
  G extends RuleGranularity<G>,
  A extends BaseClientArgs,
  P extends Record<
    keyof ParamDefinition,
    ParamDefinition[keyof ParamDefinition]
  >,
> {
  /**
   * Contains a rule's metadata.
   */
  rule: RuleExecutorClass<C, G, A>;

  /**
   * Content in the form of {advertiserId: {paramKey: paramValue}}.
   *
   * This is the information that is passed into a `Rule` on instantiation.
   */
  settings: Settings<P>;
}

/**
 * Sheets interface. Writes parameters to and from Google Sheets.
 */
export interface RuleRangeInterface<
  C extends BaseClientInterface<C, G, A>,
  G extends RuleGranularity<G>,
  A extends BaseClientArgs,
> {
  setRow(category: string, campaignId: string, column: string[]): void;

  /**
   * Given a 2-d array formatted like a rule sheet, create a {@link RuleRange}.
   *
   * A rule sheet contains the following structure:
   *
   *    ,,Category A,,Category B,,
   *    header1,header2,header3,header4,header5,header6,header7
   *    none1,none2,cata1,cata2,catb1,catb2,catb3
   */
  getValues(ruleGranularity?: G): string[][];

  getRule(ruleName: string): string[][];
  getRule(ruleName: string): string[][];
  fillRuleValues<Params>(
    rule: Pick<
      RuleDefinition<Record<keyof Params, ParamDefinition>, G>,
      'name' | 'params' | 'defaults' | 'granularity'
    >,
  ): Promise<void>;
  getRows(granularity: G): Promise<RecordInfo[]>;

  /**
   * Writes the values of a rule sheet back to the rule.
   */
  writeBack(granularity: G): void;
}

/**
 * Arguments to pass to all front-ends.
 *
 * This is used to inject arguments into implementations, which determines
 * how the client gets executed.
 */
export interface FrontendArgs<
  C extends BaseClientInterface<C, G, A>,
  G extends RuleGranularity<G>,
  A extends BaseClientArgs,
  F extends AppsScriptFrontend<C, G, A, F>,
> {
  readonly ruleRangeClass: {
    new (sheet: string[][], client: C): RuleRangeInterface<C, G, A>;
  };
  readonly rules: ReadonlyArray<
    RuleExecutorClass<C, G, A, Record<string, ParamDefinition>>
  >;
  readonly clientInitializer: (clientArgs: A, properties: PropertyStore) => C;
  readonly version: string;
  readonly migrations: Record<string, (frontend: F) => void>;
  readonly properties: PropertyStore;
}

/**
 * Parameters for a rule.
 */
export type RuleParams<
  C extends BaseClientInterface<C, G, A>,
  G extends RuleGranularity<G>,
  A extends BaseClientArgs,
  P extends Record<keyof P, ParamDefinition>,
> = RuleDefinition<P, G> & ThisType<RuleExecutor<C, G, A, P>>;

/**
 * A list of available and required Apps Script functions for Launch Monitor.
 */
export type AppsScriptFunctions =
  | 'onOpen'
  | 'initializeSheets'
  | 'preLaunchQa'
  | 'launchMonitor'
  | 'displaySetupGuide'
  | 'displayGlossary';

/**
 * An object mapping values to their anomalous status.
 */
export interface Values {
  [key: string]: Value;
}

/**
 * Represents a value that can be returned by an executed check.
 */
export interface Value {
  value: Readonly<string>;
  anomalous: Readonly<boolean>;
  alertedAt?: Readonly<number>;
  fields: Readonly<{ [key: string]: string }>;
}

/**
 * A check is a callback that can be executed.
 */
export type Check = (
  // Keeping this value flexible. Child functions will implement type.
  // tslint:disable-next-line:no-any
  test: any,
  // Keeping this value flexible. Child functions will implement type.
  // tslint:disable-next-line:no-any
  value: any,
  fields: { [key: string]: string },
) => Value;
