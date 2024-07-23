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
  AdGroupReport,
  AdGroupTargetReport,
  CampaignReport,
  CampaignTargetReport,
} from 'sa360/src/api';
import {
  ClientArgs,
  ClientArgsV2,
  ClientInterface,
  ClientInterfaceV2,
  ReportClass,
  ReportInterface,
  RuleGranularity,
} from 'sa360/src/types';

import { AD_GROUP_REPORT, CAMPAIGN_REPORT } from './api_v2';

/**
 * Creates a new rule for SA360.
 */
export const newRule = newRuleBuilder<
  ClientInterface,
  RuleGranularity,
  ClientArgs
>() as <P extends Record<keyof P, ParamDefinition>>(
  p: RuleParams<ClientInterface, RuleGranularity, ClientArgs, P>,
) => RuleExecutorClass<ClientInterface, RuleGranularity, ClientArgs, P>;

/**
 * Creates a new rule for the new SA360.
 */
export const newRuleV2 = newRuleBuilder<
  ClientInterfaceV2,
  RuleGranularity,
  ClientArgsV2
>() as <P extends Record<keyof P, ParamDefinition>>(
  p: RuleParams<ClientInterfaceV2, RuleGranularity, ClientArgsV2, P>,
) => RuleExecutorClass<ClientInterfaceV2, RuleGranularity, ClientArgsV2, P>;

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
  } = {};
  private campaignReport: CampaignReport | undefined;
  private campaignTargetReport: CampaignTargetReport | undefined;
  private adGroupReport: AdGroupReport | undefined;
  private adGroupTargetReport: AdGroupTargetReport | undefined;
  private campaigns: RecordInfo[] | undefined;
  private adGroups: RecordInfo[] | undefined;

  constructor(
    readonly args: ClientArgs,
    readonly properties: PropertyStore,
  ) {}

  async getCampaignReport(): Promise<CampaignReport> {
    if (!this.campaignReport) {
      this.campaignReport = await CampaignReport.buildReport(this.args);
    }
    return this.campaignReport;
  }

  async getCampaignTargetReport(): Promise<CampaignTargetReport> {
    if (!this.campaignTargetReport) {
      this.campaignTargetReport = await CampaignTargetReport.buildReport(
        this.args,
      );
    }
    return this.campaignTargetReport;
  }

  async getAdGroupReport(): Promise<AdGroupReport> {
    if (!this.adGroupReport) {
      this.adGroupReport = await AdGroupReport.buildReport(this.args);
    }

    return this.adGroupReport;
  }

  async getAdGroupTargetReport(): Promise<AdGroupTargetReport> {
    if (!this.adGroupTargetReport) {
      this.adGroupTargetReport = await AdGroupTargetReport.buildReport(
        this.args,
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
    settingsArray: ReadonlyArray<string[]>,
  ) {
    this.ruleStore[rule.definition.name] = new rule(this, settingsArray);
    return this;
  }

  getRule(ruleName: string) {
    return this.ruleStore[ruleName];
  }

  getUniqueKey(prefix: string) {
    return `${prefix}-${this.args.agencyId}-${this.args.advertiserId ?? 'a'}`;
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

    return { rules, results };
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
 * Client for the new SA360
 */
export class ClientV2 implements ClientInterfaceV2 {
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<
      ClientInterfaceV2,
      RuleGranularity,
      ClientArgsV2,
      Record<string, ParamDefinition>
    >;
  } = {};

  constructor(
    readonly args: ClientArgsV2,
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
    type Executor = RuleExecutor<
      ClientInterfaceV2,
      RuleGranularity,
      ClientArgsV2,
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
    rule: RuleExecutorClass<
      ClientInterfaceV2,
      RuleGranularity,
      ClientArgsV2,
      Params
    >,
    settingsArray: ReadonlyArray<string[]>,
  ) {
    this.ruleStore[rule.definition.name] = new rule(this, settingsArray);
    return this;
  }
}

/**
 * SA360 rule args splits.
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

/**
 * SA360 rule args splits.
 */
export class RuleRangeV2 extends AbstractRuleRange<
  ClientInterfaceV2,
  RuleGranularity,
  ClientArgsV2
> {
  async getRows(ruleGranularity: RuleGranularity) {
    if (ruleGranularity === RuleGranularity.CAMPAIGN) {
      return this.client.getAllCampaigns();
    } else {
      return this.client.getAllAdGroups();
    }
  }
}
