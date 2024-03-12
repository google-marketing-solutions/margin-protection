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
 * @fileoverview General rules for SA360
 */

// g3-format-prettier

import {inRange} from 'common/checks';

import {Values} from 'common/types';

import {CAMPAIGN_PACING_REPORT} from './api_v2';
import {newRuleV2} from './client';
import {RuleGranularity} from './types';

const IS_NUMBER = `=ISNUMBER(INDIRECT(ADDRESS(ROW(), COLUMN())))`;

const RULES = {
  LESS_THAN_MAX: [
    `=LT(
    INDIRECT(ADDRESS(ROW(), COLUMN())), INDIRECT(ADDRESS(ROW(), COLUMN() + 1))
  )`,
    IS_NUMBER,
  ],
  GREATER_THAN_MIN: [
    `=GT(
    INDIRECT(ADDRESS(ROW(), COLUMN())), INDIRECT(ADDRESS(ROW(), COLUMN() - 1))
  )`,
    IS_NUMBER,
  ],
};

/**
 * Pacing rule for SA360.
 */
export const budgetPacingRule = newRuleV2({
  name: 'Budget Pacing',
  description: 'Pacing',
  granularity: RuleGranularity.CAMPAIGN,
  valueFormat: {label: 'Budget/Spend'},
  params: {
    min: {
      label: 'Min. Percent Ahead/Behind',
      validationFormulas: RULES.LESS_THAN_MAX,
    },
    max: {
      label: 'Max. Percent Ahead/Behind',
      validationFormulas: RULES.GREATER_THAN_MIN,
    },
  },
  defaults: {min: '0', max: '0.5'},
  async callback() {
    const values: Values = {};
    const report = this.client.getReport(CAMPAIGN_PACING_REPORT).fetch();
    for (const campaignBudget of Object.values(report)) {
      const campaignSettings = this.settings.getOrDefault(
        campaignBudget.campaignId,
      );
      values[campaignBudget.campaignId] = inRange(
        {
          min: Number(campaignSettings.min),
          max: Number(campaignSettings.max),
        },
        Number(campaignBudget.spend) / Number(campaignBudget.budget),
        {
          campaignId: campaignBudget.campaignId,
          displayName: campaignBudget.campaignName,
          budget: String(Number(campaignBudget.budget) / 1e6),
          spend: String(Number(campaignBudget.spend) / 1e6),
        },
      );
    }

    return {values};
  },
});
