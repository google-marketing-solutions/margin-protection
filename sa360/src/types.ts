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

import * as AdTypes from 'common/ads_api_types';

import {
  BaseClientInterface,
  ClientTypes,
  RecordInfo,
  FrontendInterface,
} from 'common/types';

/**
 * Represents the related interfaces for SA360.
 */
export interface SearchAdsClientTypes
  extends ClientTypes<SearchAdsClientTypes> {
  client: ClientInterface;
  ruleGranularity: RuleGranularity;
  clientArgs: ClientArgs;
  frontend: FrontendInterface<SearchAdsClientTypes>;
}

/**
 * Args for the new SA360 API.
 */
export interface ClientArgs extends AdTypes.AdsClientArgs {
  fullFetch?: boolean;
}

/**
 * Convenience wrapper for a {@link AdTypes.ReportInterface}.
 */
export type ReportInterface<
  Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
> = AdTypes.ReportInterface<Q, Output, Params>;

/**
 * Convenience wrapper for a {@link AdTypes.ReportClass}.
 */
export type ReportClass<
  Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
> = AdTypes.ReportClass<Q, Output, Params>;

/**
 * Extends the base client interface with SA360-specific features.
 */
export interface ClientInterface
  extends BaseClientInterface<SearchAdsClientTypes> {
  getAllAdGroups(): Promise<RecordInfo[]>;
  getReport<
    Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
    Output extends string,
    Params extends string = Q['queryParams'][number],
  >(
    Report: ReportClass<Q, Output>,
  ): ReportInterface<Q, Output>;
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
