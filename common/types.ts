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

import {RuleGetter, Value} from 'anomaly_library/main';

/**
 * A rule callback is created to enable efficient API calls.
 *
 * Typically, wherever possible, rule methods should be used instead, because
 * they enable efficient pooling of API resources.
 */
export type Callback<Params extends Record<keyof Params, ParamDefinition>> =
    (client: BaseClientInterface, settings: Settings<Record<keyof Params, string>>) => () => {
      rule: RuleGetter;
      values: Value[];
    };

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
export interface BaseClientInterface {
  readonly idType: IDType;
  readonly id: string;
  readonly ruleStore:
      {[ruleName: string]: RuleExecutor<Record<string, ParamDefinition>>;};
  getAllCampaigns(): CampaignInfo[];
}

/**
 * Represents a {@link Client} class that can return a {@link BaseClientInterface}.
 */
export interface ClientConstructor {
  new(settings: Omit<ClientArgs, 'idType'|'id'>&{advertiserId: string}): BaseClientInterface;
  new(settings: Omit<ClientArgs, 'idType'|'id'>&{agencyId: string}): BaseClientInterface;
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
    P extends Record<keyof P, ParamDefinition>> extends RuleUtilities {
  uniqueKeyPrefix: string;
  run: Function;
  validate(): void;
  name: string;
  params: Record<string, ParamDefinition>;
  helper: string;
}

/**
 * Defines the type of ID set on the client.
 *
 * Can only be one of advertiser or agency.
 */
export enum IDType {
  ADVERTISER = 1,
  // Agency and Partner are the same thing for different platforms
  // (SA360 and DV360, respectively).
  PARTNER = 2,
  AGENCY = 2,
}

/**
 * Defines parameters used in a report.
 */
export interface QueryReportParams {
  idType: IDType;
  id: Readonly<string>;
  insertionOrderId: Readonly<string>;
  startDate: Readonly<Date>;
  endDate: Readonly<Date>;
}


/**
 * Parameter definitions to pass to a `Client` constructor.
 */
export interface ClientArgs {
  idType: IDType;
  id: Readonly<string>;
}

/**
 * The type-enforced parameters required to create a rule with `newRule`.
 */
export interface RuleDefinition<
    Params extends Record<keyof Params, ParamDefinition>> {
  name: string;
  params: {[Property in keyof Params]: ParamDefinition};
  uniqueKeyPrefix: string;
  defaults: {[Property in keyof Params]: string};
  helper?: string;
  callback: Callback<Params>;
}

/**
 * Extracts pertinent information from a campaign.
 */
export interface CampaignInfo {
  advertiserId: string;
  campaignId: string;
  campaignName: string;
}

