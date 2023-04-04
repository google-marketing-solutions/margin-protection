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
    }>;

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
export interface BaseClientInterface<C extends BaseClientInterface<C>> {
  readonly ruleStore:
      {[ruleName: string]: RuleExecutor<Record<string, ParamDefinition>, C>;};
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
 * Actionable object to run a rule.
 */
export interface RuleExecutor<
    P extends Record<keyof P, ParamDefinition>, C extends BaseClientInterface<C>> extends RuleUtilities {
  client: C;
  settings: Settings<Record<keyof P, string>>;
  uniqueKeyPrefix: string;
  run: Function;
  validate(): void;
  name: string;
  params: Record<string, ParamDefinition>;
  helper: string;
}

/**
 * The type-enforced parameters required to create a rule with `newRule`.
 */
export interface RuleDefinition<
    Params extends Record<keyof Params, ParamDefinition>> {
  name: string;
  params: Params;
  uniqueKeyPrefix: string;
  defaults: {[Property in keyof Params]: string};
  helper?: string;
  callback: Callback<Params>;
}

/**
 * Extracts pertinent information from a campaign.
 */
export interface RecordInfo {
  advertiserId: string;
  id: string;
  displayName: string;
}

