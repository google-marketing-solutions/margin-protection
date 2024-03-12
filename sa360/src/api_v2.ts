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
 * @fileoverview DAO for the SA360 Reporting API
 */

// g3-format-prettier

import {makeReport} from 'common/ads_api';
import {buildQuery} from 'common/ads_api_types';

/**
 * SA360 campaign-based report.
 *
 * Exposed for testing.
 */
export const CAMPAIGN_REPORT = makeReport({
  output: [
    'customerId',
    'customerName',
    'campaignId',
    'campaignName',
    'campaignStatus',
  ],
  query: buildQuery({
    queryParams: [
      'customer.id',
      'customer.name',
      'campaign.id',
      'campaign.name',
      'campaign.status',
    ] as const,
    queryFrom: 'campaign',
  }),

  transform(result) {
    return [
      result.campaign.id as string,
      {
        customerId: result.customer.id as string,
        customerName: result.customer.name as string,
        campaignId: result.campaign.id as string,
        campaignName: result.campaign.name as string,
        campaignStatus: result.campaign.status as string,
      },
    ] as const;
  },
});
