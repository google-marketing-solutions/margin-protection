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

import {RuleGetter, Values} from 'anomaly_library/main';

/**
 * A rule callback is created to enable efficient API calls.
 *
 * Typically, wherever possible, rule methods should be used instead, because
 * they enable efficient pooling of API resources.
 */
export type Callback<Params extends Record<keyof Params, ParamDefinition>> =
    () => Promise<{
      rule: RuleGetter;
      values: Values;
    }> & ThisType<Params>;

/**
 * Provides a useful data structure to get campaign ID settings.
 *
 * Defaults to the row with campaignId: 'default' if no campaign ID override is
 * set.
 */
export interface SettingMapInterface<P extends {[Property in keyof P]: P[keyof P]}> {
  getOrDefault(campaignId: string): P;
}

/**
 * Represents a matrix with IDs leading to setting key:value pairs.
 */
export type Settings<Params> =
    SettingMapInterface<{[Property in keyof Params]: Params[keyof Params]}>;

/**
 * Defines a client object, which is responsible for wrapping.
 */
export interface BaseClientInterface<C extends BaseClientInterface<C, Granularity>, Granularity extends {[Property in keyof Granularity]: Granularity}> {
  readonly ruleStore:
      {[ruleName: string]: RuleExecutor<Record<string, ParamDefinition>, C, Granularity>;};
  getAllCampaigns(): Promise<RecordInfo[]>;
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
 * Methods that are used on rule wrappers to get context.
 */
export interface RuleUtilities {
  getRule(): RuleGetter;
  getUniqueKey(): string;
}

/**
 * Determines how a rule is changed (e.g. at the campaign or ad group level).
 *
 * This includes any and all types of granularity for any and all products.
 * Use the granularity you'd like to appear on your settings page.
 */
export enum RuleGranularity {
  CAMPAIGN = 'Campaign',
  AD_GROUP = 'Ad Group',
}

/**
 * Actionable object to run a rule.
 */
export interface RuleExecutor<
    P extends Record<keyof P, ParamDefinition>, C extends BaseClientInterface<C, G>, G extends {[Property in keyof G]: G}> extends
    RuleUtilities, Omit<RuleDefinition<P, G>, 'callback'|'defaults'|'granularity'> {
  client: C;
  settings: Settings<Record<keyof P, string>>;
  run: Function;
  validate(): void;
  helper: string;
  granularity: G;
}

/**
 * The type-enforced parameters required to create a rule with `newRule`.
 */
export interface RuleDefinition<
    Params extends Record<keyof Params, ParamDefinition>, Granularity extends {[Property in keyof Granularity]: Granularity}> {
  name: string;
  callback: Callback<Params>;
  granularity: Granularity;
  params: {[Property in keyof Params]: ParamDefinition};
  uniqueKeyPrefix: string;
  defaults: {[Property in keyof Params]: string};
  helper?: string;
  /** The name of the "value" column in the anomaly detector, for reporting. */
  valueFormat: {label: string; numberFormat?: string};
}

/**
 * Extracts pertinent information from a campaign.
 */
export interface RecordInfo {
  advertiserId: string;
  id: string;
  displayName: string;
}

