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
 * @fileoverview Client for SA360.
 */

import { ReportFactory } from 'common/ads_api';
import { JoinType, QueryBuilder } from 'common/ads_api_types';
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
 * Creates a new rule for the new SA360.
 */
export const newRule = newRuleBuilder<SearchAdsClientTypes>() as <
  P extends Record<keyof P, ParamDefinition>,
>(
  p: RuleParams<SearchAdsClientTypes, P>,
) => RuleExecutorClass<SearchAdsClientTypes, P>;

/**
 * Client for the new SA360
 */
export class Client implements ClientInterface {
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<
      SearchAdsClientTypes,
      Record<string, ParamDefinition>
    >;
  } = {};

  constructor(
    readonly args: ClientArgs,
    readonly properties: PropertyStore,
    readonly reportFactory: ReportFactory,
  ) {}

  async getAllCampaigns(): Promise<RecordInfo[]> {
    const report = this.getReport(CAMPAIGN_REPORT).fetch();
    return Object.values(report).map((campaign) => ({
      advertiserId: campaign.customerId,
      id: campaign.campaignId,
      displayName: campaign.campaignName,
    }));
  }

  async getAllAdGroups(): Promise<RecordInfo[]> {
    const report = this.getReport(AD_GROUP_REPORT).fetch();
    return Object.values(report).map((adGroup) => ({
      advertiserId: adGroup.customerId,
      id: adGroup.adGroupId,
      displayName: adGroup.adGroupName,
    }));
  }

  getReport<
    Q extends QueryBuilder<Params, Joins>,
    Output extends string,
    Params extends string,
    Joins extends JoinType<Params> | undefined,
  >(
    report: ReportClass<Q, Output, Params, Joins>,
  ): ReportInterface<Q, Output, Params, Joins> {
    return this.reportFactory.create(report);
  }

  /**
   * Executes each added callable rule once per call to this method.
   *
   * This function is meant to be scheduled or otherwise called
   * by the client. It relies on a rule changing state using the anomaly
   * library.
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
      results[rule.name] = await thresholdCallable();
      rules[rule.name] = rule;
    }

    return { rules, results };
  }

  /**
   * Adds a rule to be checked by `this.validate()`.
   *
   * These rules are called whenever `this.validate()` is called, and added to
   * state.
   *
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
 * SA360 rule args splits.
 */
export class RuleRange extends AbstractRuleRange<SearchAdsClientTypes> {
  async getRows(ruleGranularity: RuleGranularity) {
    if (ruleGranularity === RuleGranularity.CAMPAIGN) {
      return this.client.getAllCampaigns();
    } else {
      return this.client.getAllAdGroups();
    }
  }
}

/**
 * SA360 rule args splits.
 */
export class RuleRangeV2 extends AbstractRuleRange<SearchAdsClientTypes> {
  async getRows(ruleGranularity: RuleGranularity) {
    if (ruleGranularity === RuleGranularity.CAMPAIGN) {
      return this.client.getAllCampaigns();
    } else {
      return this.client.getAllAdGroups();
    }
  }
}
