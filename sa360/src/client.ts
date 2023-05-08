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

import {newRuleBuilder} from 'common/client_helpers';
import {sendEmailAlert} from 'anomaly_library/main';
import {AbstractRuleRange, getTemplateSetting} from 'common/sheet_helpers';
import {ParamDefinition, RecordInfo, RuleExecutor, RuleExecutorClass, RuleParams} from 'common/types';
import {AdGroupReport, AdGroupTargetReport, CampaignReport, CampaignTargetReport} from 'sa360/src/api';
import {ClientArgs, ClientInterface, RuleGranularity} from 'sa360/src/types';

export const newRule =
    newRuleBuilder<ClientInterface, RuleGranularity, ClientArgs>() as
    <P extends Record<keyof P, ParamDefinition>>(
        p: RuleParams<ClientInterface, RuleGranularity, ClientArgs, P>) =>
        RuleExecutorClass<ClientInterface, RuleGranularity, ClientArgs, P>;

/**
 * A constant representing a named spreadsheet range, 'EMAIL_LIST'
 */
export const EMAIL_LIST_RANGE = 'EMAIL_LIST';

/**
 * A constant representing a named spreadsheet range, 'LABEL' for CSV exports
 */
export const LABEL_RANGE = 'LABEL';

/**
 * Wrapper client around the DV360 API for testability and efficiency.
 *
 * Any methods that are added as wrappers to the API should pool requests,
 * either through caching or some other method.
 */
export class Client implements ClientInterface {
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<
        ClientInterface, RuleGranularity, ClientArgs,
        Record<string, ParamDefinition>>;
  };
  private campaignReport: CampaignReport|undefined;
  private campaignTargetReport: CampaignTargetReport|undefined;
  private adGroupReport: AdGroupReport|undefined;
  private adGroupTargetReport: AdGroupTargetReport|undefined;
  private campaigns: RecordInfo[]|undefined;
  private adGroups: RecordInfo[]|undefined;

  constructor(readonly settings: ClientArgs) {
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
      this.campaignTargetReport =
          await CampaignTargetReport.buildReport(this.settings);
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
      this.adGroupTargetReport =
          await AdGroupTargetReport.buildReport(this.settings);
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
          ClientInterface, RuleGranularity, ClientArgs, Params>,
      settingsArray: readonly string[][]) {
    this.ruleStore[rule.definition.name] = new rule(this, settingsArray);
    return this;
  }

  getRule(ruleName: string) {
    return this.ruleStore[ruleName];
  }

  /**
   * Executes each added callable rule once per call to this method.
   *
   * This function is meant to be scheduled or otherwise called
   * by the client. It relies on a rule changing state using the anomaly
   * library.
   */
  async validate() {
    const thresholds: Function[] =
        Object.values(this.ruleStore).reduce((prev, rule) => {
          return [...prev, rule.run.bind(rule)];
        }, [] as Function[]);
    for (const thresholdCallable of thresholds) {
      const threshold = await thresholdCallable();
      threshold.rule.saveValues(threshold.values);
    }
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

  getAllAdvertisersForAgency(): string[] {
    const cache = CacheService.getScriptCache();
    const result: string[] = [];
    const advertisers = cache.get('advertisers');
    if (advertisers) {
      return JSON.parse(advertisers) as string[];
    }

    return result;
  }

  getAllCampaignsForAdvertiser(advertiserId: string): RecordInfo[] {
    const result: RecordInfo[] = [];

    return result;
  }

  getUniqueKey(prefix: string) {
    return `${prefix}-${this.settings.agencyId}-${
        this.settings.advertiserId ?? 'a'}`;
  }

  maybeSendEmailAlert() {
    const to =
        getTemplateSetting(EMAIL_LIST_RANGE).getValue();
    const label = getTemplateSetting(LABEL_RANGE).getValue();
    sendEmailAlert(
        Object.values(this.ruleStore).map(rule => rule.getRule()), {
          to,
          subject: `Anomalies found for ${label}`,
        });
  }
}

/**
 * SA360 rule settings splits.
 */
export class RuleRange extends
    AbstractRuleRange<ClientInterface, RuleGranularity, ClientArgs> {
  async getRows(ruleGranularity: RuleGranularity) {
    if (ruleGranularity === RuleGranularity.CAMPAIGN) {
      return this.client.getAllCampaigns();
    } else {
      return this.client.getAllAdGroups();
    }
  }
}