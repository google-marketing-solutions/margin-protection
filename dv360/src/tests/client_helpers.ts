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
  AssignedTargetingOptions,
  Campaigns,
  InsertionOrders,
} from 'dv360_api/dv360';
import {
  AssignedTargetingOption,
  Campaign,
  InsertionOrder,
} from 'dv360_api/dv360_resources';
import {
  FrequencyCap,
  InsertionOrderBudget,
  InsertionOrderBudgetSegment,
  PACING_PERIOD,
  Pacing,
  PerformanceGoal,
} from 'dv360_api/dv360_types';
import {FilterExpression} from 'dv360_api/utils';
import {FakePropertyStore} from 'common/test_helpers/mock_apps_script';

import {BudgetReport, ImpressionReport} from '../api';
import {Client} from '../client';
import {ClientArgs, IDType} from '../types';

type Callable<T> = (
  advertisers: T[],
  filter?: FilterExpression,
  maxPages?: number | undefined,
) => void;

/**
 * Allows easy creation of new templates without lots of new parameters.
 */
export type InsertionOrderTemplateConverter = (
  insertionOrder: InsertionOrderTemplate,
) => InsertionOrderTemplate;

/**
 * Allows easy creation of new templates without lots of new parameters.
 */
export type CampaignTemplateConverter = (
  campaign: CampaignTemplate,
) => CampaignTemplate;

interface TestClientParams {
  id: Readonly<string>;
  allCampaigns?: Record<string, CampaignTemplateConverter[]>;
  allAssignedTargetingOptions?: Record<
    string,
    Record<string, AssignedTargetingOption[]>
  >;
  allInsertionOrders?: Record<string, InsertionOrderTemplateConverter[]>;
  fakeSpendAmount?: number;
  fakeImpressionAmount?: number;
}

/**
 * Campaign parameters.
 */
export interface CampaignTemplate {
  id: string;
  advertiserId: string;
  campaignGoal: {
    performanceGoal: {
      performanceGoalType: string;
      performanceGoalAmountMicros: string;
    };
    campaignGoalType: string;
  };
  displayName: string;
  frequencyCap: {
    maxImpressions: number;
    unlimited: boolean;
    timeUnitCount: number;
    timeUnit: string;
  };
}

/**
 * Insertion order parameters.
 */
export interface InsertionOrderTemplate {
  id: string;
  advertiserId: string;
  displayName: string;
  campaignId: string;
  insertionOrderType: string;
  pacing: Pacing;
  frequencyCap: FrequencyCap;
  performanceGoal: PerformanceGoal;
  budget: InsertionOrderBudget;
}

/**
 * Generates a client with stubbed endpoints for testing.
 */
export function generateTestClient(param: TestClientParams) {
  const insertionOrderTemplate: InsertionOrderTemplate = {
    id: 'io1',
    advertiserId: '1',
    displayName: 'Insertion Order 1',
    campaignId: 'c1',
    insertionOrderType: 'RTB',
    pacing: {
      pacingPeriod: PACING_PERIOD.FLIGHT,
      pacingType: 'PACING_TYPE_EVEN',
    },
    frequencyCap: {
      'unlimited': true,
      'maxImpressions': 1,
    },
    performanceGoal: {
      performanceGoalType: 'PERFORMANCE_GOAL_TYPE_CPC',
      performanceGoalAmountMicros: '100000',
      performanceGoalString: '',
    },
    budget: {
      budgetUnit: 'BUDGET_UNIT_CURRENCY',
      budgetSegments: [
        {
          budgetAmountMicros: '100000',
          dateRange: {
            startDate: {
              year: 1970,
              month: 1,
              day: 1,
            },
            endDate: {
              year: 1970,
              month: 12,
              day: 31,
            },
          },
        },
      ],
    },
  };

  const campaignTemplate: CampaignTemplate = {
    id: 'c1',
    advertiserId: '1',
    campaignGoal: {
      'campaignGoalType': 'CAMPAIGN_GOAL_TYPE_UNSPECIFIED',
      'performanceGoal': {
        'performanceGoalType': 'PERFORMANCE_GOAL_TYPE_CPM',
        'performanceGoalAmountMicros': '10',
      },
    },
    displayName: 'Campaign 1',
    frequencyCap: {
      'unlimited': false,
      'timeUnit': 'TIME_UNIT_LIFETIME',
      'timeUnitCount': 1,
      'maxImpressions': 10,
    },
  };

  const clientArgs: ClientArgs = {id: param.id, idType: IDType.ADVERTISER};
  if (param.allCampaigns) {
    class FakeCampaigns extends Campaigns {
      readonly id: string = 'c1';
      override list(callback: Callable<Campaign>) {
        callback(
          param.allCampaigns![param.id].map(
            (c) => new Campaign(c({...campaignTemplate})),
          ),
        );
      }
    }

    clientArgs.campaigns = FakeCampaigns;
  }

  if (param.allAssignedTargetingOptions) {
    class FakeTargetingOptions extends AssignedTargetingOptions {
      override list(callback: Callable<AssignedTargetingOption>) {
        const campaignId = this.getCampaignId();
        if (!campaignId) {
          throw new Error('Missing campaign ID');
        }
        callback(param.allAssignedTargetingOptions![param.id][campaignId]);
      }
    }

    clientArgs.assignedTargetingOptions = FakeTargetingOptions;
  }

  if (param.allInsertionOrders) {
    class FakeInsertionOrders extends InsertionOrders {
      override list(callback: Callable<InsertionOrder>) {
        callback(
          param.allInsertionOrders![param.id].map(
            (c) => new InsertionOrder(c({...insertionOrderTemplate})),
          ),
        );
      }
    }

    clientArgs.insertionOrders = FakeInsertionOrders;
  }

  if (param.fakeSpendAmount) {
    class FakeBudgetReport extends BudgetReport {
      protected override getReport() {
        return {};
      }

      override getSpendForInsertionOrder() {
        return param.fakeSpendAmount!;
      }
    }

    clientArgs.budgetReport = FakeBudgetReport;
  }

  if (param.fakeImpressionAmount) {
    class FakeImpressionReport extends ImpressionReport {
      override getImpressionPercentOutsideOfGeos(
        campaignId: string,
        countries: string[],
      ) {
        return param.fakeImpressionAmount!;
      }

      override getReport() {
        return {};
      }
    }

    clientArgs.impressionReport = FakeImpressionReport;
  }
  return new Client(clientArgs, new FakePropertyStore());
}

interface TestDataParams {
  advertiserId: string;
  geoTargets?: string[];
  insertionOrderBudgetSegments?: InsertionOrderBudgetSegment[];
  columns?: string[][];
  campaignId?: string;
}

/**
 * Contains properties we care about from geo.
 */
export interface GeoTargetTestDataParams extends TestDataParams {
  geoTargets?: string[];
  excludes?: string[];
}

/**
 * Contains properties we care about from an insertion order.
 */
export interface InsertionOrderTestDataParams extends TestDataParams {
  fakeSpendAmount?: number;
}
