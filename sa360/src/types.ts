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

import {BaseClientArgs, BaseClientInterface, RecordInfo} from 'common/types';
import {AdGroupReport, AdGroupTargetReport, CampaignReport, CampaignTargetReport} from 'sa360/src/api';

/**
 * Extends the base client interface with SA360-specific features.
 */
export interface ClientInterface extends BaseClientInterface<ClientInterface, RuleGranularity, ClientArgs> {
  getCampaignReport(): Promise<CampaignReport>;
  getCampaignTargetReport(): Promise<CampaignTargetReport>;
  getAdGroupReport(): Promise<AdGroupReport>;
  getAdGroupTargetReport(): Promise<AdGroupTargetReport>;
  getAllAdGroups(): Promise<RecordInfo[]>;
  settings: ClientArgs;
}

/**
 * An agency ID and, optionally, an advertiser ID to narrow down.
 */
export interface ClientArgs extends BaseClientArgs<ClientInterface, RuleGranularity, ClientArgs> {
  agencyId: string;
  advertiserId?: string;
}

export enum RuleGranularity {
  CAMPAIGN = 'Campaign',
  AD_GROUP = 'Ad Group',
}