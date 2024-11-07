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

import {
  Advertisers,
  AssignedTargetingOptions,
  Campaigns,
  InsertionOrders,
  LineItems,
} from 'dv360_api/dv360';
import {
  Advertiser,
  AssignedTargetingOption,
  Campaign,
  InsertionOrder,
  LineItem,
} from 'dv360_api/dv360_resources';
import {
  ApiDate,
  FrequencyCap,
  InsertionOrderBudget,
  InsertionOrderBudgetSegment,
  Kpi,
  LINE_ITEM_FLIGHT_DATE_TYPE,
  LINE_ITEM_TYPE,
  LineItemBudget,
  LineItemFlight,
  LineItemType,
  PACING_PERIOD,
  Pacing,
  PacingType,
} from 'dv360_api/dv360_types';
import { FilterExpression } from 'dv360_api/utils';
import { FakePropertyStore } from 'common/test_helpers/mock_apps_script';

import { BudgetReport, ImpressionReport, LineItemBudgetReport } from '../api';
import { Client, DataAccessObject } from '../client';
import { Accessors, ClientArgs, IDType } from '../types';

type Callable<T> = (
  advertisers: T[],
  filter?: FilterExpression,
  maxPages?: number | undefined,
) => void;

/**
 * Allows easy creation of new templates without lots of new parameters.
 */
export type AdvertiserTemplateConverter = (
  advertiser: AdvertiserTemplate,
) => AdvertiserTemplate;

/**
 * Allows easy creation of new templates without lots of new parameters.
 */
export type InsertionOrderTemplateConverter = (
  insertionOrder: InsertionOrderTemplate,
) => InsertionOrderTemplate;

/**
 * Allows easy creation of new templates without lots of new parameters.
 *
 */
export type LineItemTemplateConverter = (
  lineItem: LineItemTemplate,
) => LineItemTemplate;

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
  allAdvertisers?: Record<string, AdvertiserTemplateConverter[]>;
  allInsertionOrders?: Record<string, InsertionOrderTemplateConverter[]>;
  allLineItems?: Record<string, LineItemTemplateConverter[]>;
  fakeSpendAmount?: number;
  fakeImpressionAmount?: number;
  clientArgs?: ClientArgs;
}

/**
 * Campaign parameters.
 */
export interface CampaignTemplate {
  id: string;
  advertiserId: string;
  campaignId: string;
  campaignFlight: {
    plannedDates: {
      startDate: { year: number; month: number; day: number };
    };
  };
  entityStatus: string;
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
 * Line item parameters.
 */
export interface LineItemTemplate {
  id: string;
  advertiserId: string;
  displayName: string;
  insertionOrderId: string;
  campaignId: string;
  pacing: Pacing;
  budget: LineItemBudget;
  lineItemType: LineItemType;
  flight: LineItemFlight;
  frequencyCap: FrequencyCap;
  partnerRevenueModel: { markupType: string; markupAmount: string };
  bidStrategy: { fixedBid: { bidAmountMicros: string } };
}

/**
 * Advertiser parameters.
 */
export interface AdvertiserTemplate {
  id: string;
  displayName: string;
  partnerId: string;
  generalConfig: {
    domainUrl: string;
    currencyCode: string;
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
  kpi: Kpi;
  budget: InsertionOrderBudget;
}

/**
 * Encapsulation of a test client creator.
 *
 * Call with {@link generateTestClient}.
 */
export class TestClient {
  private readonly insertionOrderTemplate: InsertionOrderTemplate = {
    id: 'io1',
    advertiserId: '1',
    displayName: 'Insertion Order 1',
    campaignId: 'c1',
    insertionOrderType: 'RTB',
    pacing: {
      pacingPeriod: PACING_PERIOD.FLIGHT,
      pacingType: 'PACING_TYPE_AHEAD',
    },
    frequencyCap: {
      unlimited: true,
      maxImpressions: 1,
    },
    kpi: {
      kpiType: 'KPI_TYPE_CPC',
      kpiAmountMicros: '100000',
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

  private readonly lineItemTemplate: LineItemTemplate = {
    id: 'li1',
    advertiserId: '1',
    insertionOrderId: 'io1',
    campaignId: 'c1',
    displayName: 'Line Item 1',
    pacing: {
      pacingType: 'PACING_TYPE_AHEAD',
      pacingPeriod: 'PACING_PERIOD_DAILY',
    },
    budget: {
      budgetAllocationType: 'LINE_ITEM_BUDGET_ALLOCATION_TYPE_AUTOMATIC',
      budgetUnit: 'BUDGET_UNIT_CURRENCY',
      maxAmount: (100_000_000).toString(),
    },
    lineItemType: LINE_ITEM_TYPE.DISPLAY_DEFAULT,
    flight: {
      flightDateType: LINE_ITEM_FLIGHT_DATE_TYPE.INHERITED,
      dateRange: {
        startDate: new ApiDate(1970, 1, 1),
        endDate: new ApiDate(1970, 1, 3),
      },
    },
    frequencyCap: {
      unlimited: false,
      timeUnit: 'TIME_UNIT_LIFETIME',
      timeUnitCount: 1,
      maxImpressions: 10,
    },
    partnerRevenueModel: {
      markupType: 'PARTNER_REVENUE_MODEL_MARKUP_TYPE_CPM',
      markupAmount: '1',
    },
    bidStrategy: {
      fixedBid: { bidAmountMicros: String(1_000_000) },
    },
  };
  readonly campaignTemplate: CampaignTemplate = {
    id: 'c1',
    advertiserId: '1',
    campaignGoal: {
      campaignGoalType: 'CAMPAIGN_GOAL_TYPE_UNSPECIFIED',
      performanceGoal: {
        performanceGoalType: 'PERFORMANCE_GOAL_TYPE_CPM',
        performanceGoalAmountMicros: '10',
      },
    },
    entityStatus: 'ENTITY_STATUS_ACTIVE',
    displayName: 'Campaign 1',
    frequencyCap: {
      unlimited: false,
      timeUnit: 'TIME_UNIT_LIFETIME',
      timeUnitCount: 1,
      maxImpressions: 10,
    },
    campaignId: '',
    campaignFlight: {
      plannedDates: {
        startDate: { year: 2000, month: 1, day: 1 },
      },
    },
  };

  private readonly advertiserTemplate: AdvertiserTemplate = {
    partnerId: '1',
    id: 'a1',
    displayName: 'Advertiser 1',
    generalConfig: {
      domainUrl: 'https://example.co',
      currencyCode: 'USD',
    },
  };
  private readonly clientArgs: ClientArgs;

  constructor(private readonly params: TestClientParams) {
    this.clientArgs = params.clientArgs
      ? this.params.clientArgs
      : {
          id: this.params.id,
          idType: IDType.ADVERTISER,
          label: 'test',
        };
  }
  generate() {
    const accessors: Accessors = {
      budgetReport: BudgetReport,
      lineItemBudgetReport: LineItemBudgetReport,
      impressionReport: ImpressionReport,
      advertisers: Advertisers,
      assignedTargetingOptions: AssignedTargetingOptions,
      campaigns: Campaigns,
      insertionOrders: InsertionOrders,
      lineItems: LineItems,
    };
    if (this.params.allCampaigns) {
      accessors.campaigns = fakeCampaignsClass(
        this.params,
        this.campaignTemplate,
      );
    }

    if (this.params.allAdvertisers) {
      accessors.advertisers = fakeAdvertisersClass(
        this.params,
        this.advertiserTemplate,
      );
    }

    if (this.params.allAssignedTargetingOptions) {
      accessors.assignedTargetingOptions = fakeTargetingOptionsClass(
        this.params,
      );
    }

    if (this.params.allInsertionOrders) {
      accessors.insertionOrders = fakeInsertionOrdersClass(
        this.params,
        this.insertionOrderTemplate,
      );
      if (this.params.fakeSpendAmount) {
        accessors.budgetReport = fakeBudgetReportClass(this.params);
      }
    }

    if (this.params.allLineItems) {
      accessors.lineItems = fakeLineItemsClass(
        this.params,
        this.lineItemTemplate,
      );
      if (this.params.fakeSpendAmount) {
        accessors.lineItemBudgetReport = fakeLineItemBudgetReportClass(
          this.params,
        );
      }
    }

    if (this.params.fakeImpressionAmount) {
      accessors.impressionReport = fakeImpressionsReportClass(this.params);
    }

    return new Client(
      this.clientArgs,
      new FakePropertyStore(),
      new DataAccessObject(accessors),
    );
  }
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

/**
 * Contains properties we care about from an line item.
 */
export interface LineItemTestDataParams extends TestDataParams {
  fakeSpendAmount?: number;
  pacingType?: PacingType;
  columns: string[][];
  startDate: ApiDate;
  endDate: ApiDate;
  budget: string;
}

function fakeBudgetReportClass(params: TestClientParams) {
  return class FakeBudgetReport extends BudgetReport {
    protected override getReport() {
      return {};
    }

    override getSpendForInsertionOrder() {
      return params.fakeSpendAmount!;
    }
  };
}

function fakeTargetingOptionsClass(params: TestClientParams) {
  return class FakeTargetingOptions extends AssignedTargetingOptions {
    override list(callback: Callable<AssignedTargetingOption>) {
      const campaignId = this.getCampaignId();
      if (!campaignId) {
        throw new Error('Missing campaign ID');
      }
      callback(params.allAssignedTargetingOptions![params.id][campaignId]);
    }
  };
}

function fakeInsertionOrdersClass(
  params: TestClientParams,
  insertionOrderTemplate: InsertionOrderTemplate,
) {
  return class FakeInsertionOrders extends InsertionOrders {
    override list(callback: Callable<InsertionOrder>) {
      this.advertiserIds.map((advertiserId) => {
        try {
          callback(
            params.allInsertionOrders![advertiserId].map(
              (c) => new InsertionOrder(c({ ...insertionOrderTemplate })),
            ),
          );
        } catch {
          console.debug(`Insertion Order ${advertiserId} Skipped`);
        }
      });
    }
  };
}

function fakeLineItemsClass(
  params: TestClientParams,
  lineItemTemplate: LineItemTemplate,
) {
  return class FakeLineItems extends LineItems {
    override list(callback: Callable<LineItem>) {
      for (const advertiserId of this.advertiserIds) {
        callback(
          params.allLineItems![advertiserId].map(
            (c) => new LineItem(c({ ...lineItemTemplate })),
          ),
        );
      }
    }
  };
}

function fakeLineItemBudgetReportClass(params: TestClientParams) {
  return class FakeLineItemBudgetReport extends LineItemBudgetReport {
    protected override getReport() {
      return {};
    }

    override getSpendForLineItem(): number {
      return params.fakeSpendAmount;
    }
  };
}

function fakeImpressionsReportClass(params: TestClientParams) {
  return class FakeImpressionReport extends ImpressionReport {
    override getImpressionPercentOutsideOfGeos() {
      return params.fakeImpressionAmount!;
    }

    override getReport() {
      return {};
    }
  };
}

function fakeCampaignsClass(
  params: TestClientParams,
  campaignTemplate: CampaignTemplate,
) {
  return class FakeCampaigns extends Campaigns {
    override list(callback: Callable<Campaign>) {
      for (const advertiserId of this.advertiserIds) {
        callback(
          params.allCampaigns![advertiserId].map(
            (c) => new Campaign(c({ ...campaignTemplate })),
          ),
        );
      }
    }
  };
}

function fakeAdvertisersClass(
  params: TestClientParams,
  advertiserTemplate: AdvertiserTemplate,
) {
  return class FakeAdvertisers extends Advertisers {
    override list(callback: Callable<Advertiser>) {
      callback(
        (Object.values(params.allAdvertisers).flat(1) || []).map(
          (a) => new Advertiser(a({ ...advertiserTemplate })),
        ),
      );
    }
  };
}

/**
 * Provides a mock client for testing.
 */
export function generateTestClient(params: TestClientParams) {
  return new TestClient(params).generate();
}
