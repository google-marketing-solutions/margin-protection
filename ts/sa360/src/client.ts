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
 * @fileoverview This file defines the `Client` class for the SA360 Launch
 * Monitor. This class is the primary interface for interacting with the SA360
 * API, managing rules, and executing validation logic.
 */

import { ReportFactory } from 'common/ads_api';
import { Query, QueryBuilder } from 'common/ads_api_types';
import { newRuleBuilder } from 'common/client_helpers';
import { AbstractRuleRange } from 'common/sheet_helpers';
import {
  ExecutorResult,
  ParamDefinition,
  PropertyStore,
  RecordInfo,
  RuleExecutor,
  RuleExecutorClass,
  RuleParams,
} from 'common/types';
import {
  ClientArgs,
  ClientInterface,
  ReportClass,
  ReportInterface,
  RuleGranularity,
  SearchAdsClientTypes,
} from 'sa360/src/types';

import { AD_GROUP_REPORT, CAMPAIGN_REPORT } from './api';

/**
 * A pre-configured `newRuleBuilder` for creating rules specific to SA360.
 */
export const newRule = newRuleBuilder<SearchAdsClientTypes>() as <
  P extends Record<keyof P, ParamDefinition>,
>(
  p: RuleParams<SearchAdsClientTypes, P>,
) => RuleExecutorClass<SearchAdsClientTypes, P>;

/**
 * A high-level client for the SA360 API that simplifies fetching data,
 * managing rules, and executing validation logic. It uses the common Ads API
 * for its backend operations.
 */
export class Client implements ClientInterface {
  /** A store of all registered rule executors, indexed by name. */
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<
      SearchAdsClientTypes,
      Record<string, ParamDefinition>
    >;
  } = {};

  /**
   * @param args The client arguments, specifying the customer IDs.
   * @param properties A `PropertyStore` instance for caching.
   * @param reportFactory A factory for creating report instances.
   */
  constructor(
    readonly args: ClientArgs,
    readonly properties: PropertyStore,
    readonly reportFactory: ReportFactory,
  ) {}

  /**
   * Fetches all campaigns for the configured customer ID(s).
   * @return A promise that resolves to an array of campaign records.
   */
  async getAllCampaigns(): Promise<RecordInfo[]> {
    const report = this.getReport(CAMPAIGN_REPORT).fetch();
    return Object.values(report).map((campaign) => ({
      advertiserId: campaign.customerId,
      id: campaign.campaignId,
      displayName: campaign.campaignName,
    }));
  }

  /**
   * Fetches all ad groups for the configured customer ID(s).
   * @return A promise that resolves to an array of ad group records.
   */
  async getAllAdGroups(): Promise<RecordInfo[]> {
    const report = this.getReport(AD_GROUP_REPORT).fetch();
    return Object.values(report).map((adGroup) => ({
      advertiserId: adGroup.customerId,
      id: adGroup.adGroupId,
      displayName: adGroup.adGroupName,
    }));
  }

  /**
   * Creates a report instance using the report factory.
   * @param report The report class to instantiate.
   * @return An instance of the requested report.
   */
  getReport<
    Q extends QueryBuilder<Query<Params>>,
    Output extends string,
    Params extends string,
  >(
    report: ReportClass<Q, Output, Params>,
  ): ReportInterface<Q, Output, Params> {
    return this.reportFactory.create(report);
  }

  /**
   * Executes all enabled rules and returns their results.
   *
   * This is the main entry point for running the validation logic, intended to
   * be called by a scheduled trigger or a user action.
   *
   * @return A promise that resolves to an object containing the executed rules
   *     and their corresponding results.
   */
  async validate() {
    type Executor = RuleExecutor<SearchAdsClientTypes>;
    const thresholds: Array<[Executor, () => Promise<ExecutorResult>]> =
      Object.values(this.ruleStore).reduce(
        (prev, rule) => {
          return [...prev, [rule, rule.run.bind(rule)]];
        },
        [] as Array<[Executor, () => ExecutorResult]>,
      );
    const rules: Record<string, Executor> = {};
    const results: Record<string, ExecutorResult> = {};
    for (const [rule, thresholdCallable] of thresholds) {
      if (!rule.enabled) {
        results[rule.name] = { values: {} };
        rules[rule.name] = rule;
      } else {
        results[rule.name] = await thresholdCallable();
        rules[rule.name] = rule;
      }
    }

    return { rules, results };
  }

  /**
   * Adds a new rule to the client's rule store.
   *
   * @param rule The rule class to add.
   * @param settingsArray A 2D array of settings for this rule from the sheet.
   * @return The client instance, for chaining.
   */
  addRule<Params extends Record<keyof Params, ParamDefinition>>(
    rule: RuleExecutorClass<SearchAdsClientTypes>,
    settingsArray: ReadonlyArray<string[]>,
  ) {
    this.ruleStore[rule.definition.name] = new rule(this, settingsArray);
    return this;
  }
}

/**
 * A concrete implementation of `AbstractRuleRange` tailored for SA360.
 * It defines how to fetch entities (Campaigns or Ad Groups) for the settings
 * sheets based on the rule's granularity.
 */
export class RuleRange extends AbstractRuleRange<SearchAdsClientTypes> {
  /**
   * Returns an empty array as there is no additional metadata for SA360 rules.
   */
  async getRuleMetadata() {
    return [];
  }
  /**
   * Fetches the rows of entities (Campaigns or Ad Groups) based on the rule's
   * granularity.
   * @param ruleGranularity The granularity to fetch.
   * @return A promise that resolves to an array of entity records.
   */
  async getRows(ruleGranularity: RuleGranularity) {
    if (ruleGranularity === RuleGranularity.CAMPAIGN) {
      return this.client.getAllCampaigns();
    } else {
      return this.client.getAllAdGroups();
    }
  }
}
