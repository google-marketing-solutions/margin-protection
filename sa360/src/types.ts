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
 * @fileoverview types for Google Ads
 */

// g3-format-prettier

import {
  BaseClientArgs,
  BaseClientInterface,
  RecordInfo,
} from 'common/types';
import {
  AdGroupReport,
  AdGroupTargetReport,
  CampaignReport,
  CampaignTargetReport,
} from 'sa360/src/api';

/**
 * Extends the base client interface with SA360-specific features.
 */
export interface ClientInterface
  extends BaseClientInterface<ClientInterface, RuleGranularity, ClientArgs> {
  getCampaignReport(): Promise<CampaignReport>;
  getCampaignTargetReport(): Promise<CampaignTargetReport>;
  getAdGroupReport(): Promise<AdGroupReport>;
  getAdGroupTargetReport(): Promise<AdGroupTargetReport>;
  getAllAdGroups(): Promise<RecordInfo[]>;
  args: ClientArgs;
}

/**
 * Extends the base client interface with SA360-specific features.
 */
export interface ClientInterfaceV2
  extends BaseClientInterface<
    ClientInterfaceV2,
    RuleGranularity,
    ClientArgsV2
  > {
  getCampaignReport(): Promise<CampaignReport>;
  getCampaignTargetReport(): Promise<CampaignTargetReport>;
  getAdGroupReport(): Promise<AdGroupReport>;
  getAdGroupTargetReport(): Promise<AdGroupTargetReport>;
  getAllAdGroups(): Promise<RecordInfo[]>;
  args: ClientArgsV2;
}

/**
 * Args for the new SA360 API.
 */
export interface ClientArgsV2 extends BaseClientArgs {
  customerId: string;
  loginCustomerId?: string;
  fullFetch?: boolean;
}

/**
 * An agency ID and, optionally, an advertiser ID to narrow down.
 */
export interface ClientArgs extends BaseClientArgs {
  agencyId: string;
  advertiserId?: string;

  /**
   * False = incremental pull
   * True = pull everything
   */
  fullFetch?: boolean;
}

/**
 * SA360 granularity options.
 */
export enum RuleGranularity {
  CAMPAIGN = 'Campaign',
  AD_GROUP = 'Ad Group',
}

interface ChangedAttributesSinceTimestamp {
  changedAttributesSinceTimestamp: string;
}

interface ChangedMetricsSinceTimestamp {
  changedMetricsSinceTimestamp: string;
}

interface StartAndEndDate {
  startDate: string;
  endDate: string;
}

/**
 * SA360 report time range.
 *
 * https://developers.google.com/search-ads/v2/reference/reports#request.timeRange
 */
export type SearchAdsTimeRange =
  | StartAndEndDate
  | ChangedMetricsSinceTimestamp
  | ChangedAttributesSinceTimestamp;
