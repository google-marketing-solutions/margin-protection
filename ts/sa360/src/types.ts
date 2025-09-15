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
 * @fileoverview This file contains the TypeScript interfaces and enums that
 * are specific to the SA360 Launch Monitor implementation. It builds upon the
 * common types to create contracts tailored for SA360 entities and logic.
 */

import * as AdTypes from 'common/ads_api_types';

import {
  BaseClientInterface,
  ClientTypes,
  RecordInfo,
  FrontendInterface,
} from 'common/types';

/**
 * A concrete implementation of the generic `ClientTypes` interface, bundling
 * all the SA360-specific types together.
 */
export interface SearchAdsClientTypes
  extends ClientTypes<SearchAdsClientTypes> {
  client: ClientInterface;
  ruleGranularity: RuleGranularity;
  clientArgs: ClientArgs;
  frontend: FrontendInterface<SearchAdsClientTypes>;
}

/**
 * Defines the arguments required to initialize the SA360 client.
 */
export interface ClientArgs extends AdTypes.AdsClientArgs {
  /**
   * An optional flag to indicate whether a full fetch should be performed,
   * ignoring any caching or incremental logic.
   */
  fullFetch?: boolean;
}

/**
 * A convenience type alias for the generic `ReportInterface`.
 */
export type ReportInterface<
  Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
> = AdTypes.ReportInterface<Q, Output, Params>;

/**
 * A convenience type alias for the generic `ReportClass`.
 */
export type ReportClass<
  Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
> = AdTypes.ReportClass<Q, Output, Params>;

/**
 * Defines the interface for the SA360 client, extending the base client with
 * SA360-specific methods.
 */
export interface ClientInterface
  extends BaseClientInterface<SearchAdsClientTypes> {
  /** Fetches all ad groups for the client's scope. */
  getAllAdGroups(): Promise<RecordInfo[]>;
  /**
   * Creates a report instance using the report factory.
   * @param Report The report class to instantiate.
   * @return An instance of the requested report.
   */
  getReport<
    Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
    Output extends string,
    Params extends string = Q['queryParams'][number],
  >(
    Report: ReportClass<Q, Output>,
  ): ReportInterface<Q, Output>;
}

/**
 * An enum defining the entity levels at which a rule can be configured.
 */
export enum RuleGranularity {
  CAMPAIGN = 'Campaign',
  AD_GROUP = 'Ad Group',
}

/**
 * Defines the structure for a time range based on changed attributes.
 */
interface ChangedAttributesSinceTimestamp {
  changedAttributesSinceTimestamp: string;
}

/**
 * Defines the structure for a time range based on changed metrics.
 */
interface ChangedMetricsSinceTimestamp {
  changedMetricsSinceTimestamp: string;
}

/**
 * Defines the structure for a time range based on a start and end date.
 */
interface StartAndEndDate {
  startDate: string;
  endDate: string;
}

/**
 * A type representing the possible time range structures for an SA360 report
 * request.
 * @see https://developers.google.com/search-ads/v2/reference/reports#request.timeRange
 */
export type SearchAdsTimeRange =
  | StartAndEndDate
  | ChangedMetricsSinceTimestamp
  | ChangedAttributesSinceTimestamp;
