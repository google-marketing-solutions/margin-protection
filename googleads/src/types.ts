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

// g3-format-prettier

import {
  BaseClientArgs,
  BaseClientInterface,
} from 'common/types';

/**
 * Extends the base client interface with Google Ads-specific features.
 */
export interface ClientInterface
  extends BaseClientInterface<ClientInterface, RuleGranularity, ClientArgs> {}

/**
 * Necessary Ads API request metadata
 */
export interface ClientArgs
  extends BaseClientArgs<ClientInterface, RuleGranularity, ClientArgs> {
  developerToken: string;
}

/**
 * The user-provided tree of known Ads accounts to run a report against.
 */
export interface AccountMap {
  /**
   * The customer ID of the Google Ads account. The root node should always
   * contain a login customer ID.
   */
  readonly customerId: string;
  /** Expands reporting for child accounts. Overrides `children`. */
  expand?: boolean;
  /**
   * Restricts reporting to a subset of child accounts. If empty, defaults to
   * expanding all leaves, maybe just this node.
   */
  children?: AccountMap[];
}

/**
 * A report for a single campaign.
 */
export interface CampaignReport {
  customerId: string;
  customerName: string;
  id: string;
  name: string;
  status: string;
}

/**
 * The level at which to apply this rule.
 */
export enum RuleGranularity {
  CAMPAIGN = 'Campaign',
  AD_GROUP = 'Ad Group',
}
