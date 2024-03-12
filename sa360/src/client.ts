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

// g3-format-prettier

import {PropertyStore} from 'google3/third_party/professional_services/solutions/appsscript_anomaly_library/lib/main';
import {newRuleBuilder} from 'common/client_helpers';

import {AbstractRuleRange} from 'common/sheet_helpers';
import {
  ExecutorResult,
  ParamDefinition,
  RecordInfo,
  RuleExecutor,
  RuleExecutorClass,
  RuleParams,
} from 'common/types';
import {
  AdGroupReport,
  AdGroupTargetReport,
  CampaignReport,
  CampaignTargetReport,
} from 'sa360/src/api';
import {
  ClientArgs,
  ClientInterface,
  RuleGranularity,
} from 'sa360/src/types';

export const newRule = newRuleBuilder<
  ClientInterface,
  RuleGranularity,
  ClientArgs
>() as <P extends Record<keyof P, ParamDefinition>>(
  p: RuleParams<ClientInterface, RuleGranularity, ClientArgs, P>,
) => RuleExecutorClass<ClientInterface, RuleGranularity, ClientArgs, P>;

/**
 * Wrapper client around the DV360 API for testability and efficiency.
 *
 * Any methods that are added as wrappers to the API should pool requests,
 * either through caching or some other method.
 */
export class Client implements ClientInterface {
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<
      ClientInterface,
      RuleGranularity,
      ClientArgs,
      Record<string, ParamDefinition>
    >;
  };
  private campaignReport: CampaignReport | undefined;
  private campaignTargetReport: CampaignTargetReport | undefined;
  private adGroupReport: AdGroupReport | undefined;
  private adGroupTargetReport: AdGroupTargetReport | undefined;
  private campaigns: RecordInfo[] | undefined;
  private adGroups: RecordInfo[] | undefined;

  constructor(
    readonly settings: ClientArgs,
    readonly properties: PropertyStore,
  ) {
    this.ruleStore = {};
  }

  async getCampaignReport(): Promise<CampaignReport> {
    if (!this.campaignReport) {
      this.campaignReport = await CampaignReport.buildReport(this.settings);
    }
    return this.campaignReport;
  }

  async getCampaignTargetReport(): Promise<CampaignTargetReport> {
    if (!this.campaignTargetReport) {
      this.campaignTargetReport = await CampaignTargetReport.buildReport(
        this.settings,
      );
    }
    return this.campaignTargetReport;
  }

  async getAdGroupReport(): Promise<AdGroupReport> {
    if (!this.adGroupReport) {
      this.adGroupReport = await AdGroupReport.buildReport(this.settings);
    }

    return this.adGroupReport;
  }

  async getAdGroupTargetReport(): Promise<AdGroupTargetReport> {
    if (!this.adGroupTargetReport) {
      this.adGroupTargetReport = await AdGroupTargetReport.buildReport(
        this.settings,
      );
    }

    return this.adGroupTargetReport;
  }

  /**
   * Adds a rule to be checked by `this.validate()`.
   *
   * These rules are called whenever `this.validate()` is called, and added to
   * state.
   *
   */
  addRule<Params extends Record<keyof Params, ParamDefinition>>(
    rule: RuleExecutorClass<
      ClientInterface,
      RuleGranularity,
      ClientArgs,
      Params
    >,
    settingsArray: readonly string[][],
  ) {
    this.ruleStore[rule.definition.name] = new rule(this, settingsArray);
    return this;
  }

  getRule(ruleName: string) {
    return this.ruleStore[ruleName];
  }

  getUniqueKey(prefix: string) {
    return `${prefix}-${this.settings.agencyId}-${
      this.settings.advertiserId ?? 'a'
    }`;
  }

  /**
   * Executes each added callable rule once per call to this method.
   *
   * This function is meant to be scheduled or otherwise called
   * by the client. It relies on a rule changing state using the anomaly
   * library.
   */
  async validate() {
    type Executor = RuleExecutor<
      ClientInterface,
      RuleGranularity,
      ClientArgs,
      Record<string, ParamDefinition>
    >;
    const thresholds: Array<[Executor, Function]> = Object.values(
      this.ruleStore,
    ).reduce(
      (prev, rule) => {
        return [...prev, [rule, rule.run.bind(rule)]];
      },
      [] as Array<[Executor, Function]>,
    );
    const rules: Record<string, Executor> = {};
    const results: Record<string, ExecutorResult> = {};
    for (const [rule, thresholdCallable] of thresholds) {
      results[rule.name] = await thresholdCallable();
      rules[rule.name] = rule;
    }

    return {rules, results};
  }

  async getAllCampaigns(): Promise<RecordInfo[]> {
    if (!this.campaigns) {
      const campaignReport = await this.getCampaignReport();
      this.campaigns = campaignReport.getCampaigns();
    }
    return this.campaigns;
  }

  async getAllAdGroups(): Promise<RecordInfo[]> {
    if (!this.adGroups) {
      const adGroupReport = await this.getAdGroupReport();
      this.adGroups = adGroupReport.getAdGroups();
    }
    return this.adGroups;
  }
}

/**
 * SA360 rule settings splits.
 */
export class RuleRange extends AbstractRuleRange<
  ClientInterface,
  RuleGranularity,
  ClientArgs
> {
  async getRows(ruleGranularity: RuleGranularity) {
    if (ruleGranularity === RuleGranularity.CAMPAIGN) {
      return this.client.getAllCampaigns();
    } else {
      return this.client.getAllAdGroups();
    }
  }
}
