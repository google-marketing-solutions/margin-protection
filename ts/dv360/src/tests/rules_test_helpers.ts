import {AssignedTargetingOption} from 'dv360_api/dv360_resources';
import {
  CampaignTemplate,
  generateTestClient,
  GeoTargetTestDataParams,
  InsertionOrderTemplate,
  InsertionOrderTestDataParams,
  LineItemTemplate,
  LineItemTestDataParams,
} from './client_helpers';
import {ApiDate, PACING_TYPE, TARGETING_TYPE} from 'dv360_api/dv360_types';
import {
  budgetPacingPercentageRule,
  budgetPacingRuleLineItem,
  dailyBudgetRule,
  geoTargetRule,
  impressionsByGeoTarget,
} from '../rules';
import {RuleExecutorClass} from 'common/types';
import {DisplayVideoClientTypes} from '../types';
import {Client} from '../client';

/**
 *
 * Generates geo test data for the tests below.
 */
export async function generateGeoTestData({
  advertiserId,
  geoTargets = [],
  excludes = [],
  columns = [
    ['', 'Required Geo Targets', 'Allowed Geo Targets', 'Excluded Geo Targets'],
    ['default', '', 'United Kingdom, United States', ''],
  ],
  campaignId = 'c1',
}: GeoTargetTestDataParams) {
  const allInsertionOrders = {
    [advertiserId]: [(template: InsertionOrderTemplate) => template],
  };

  const allCampaigns = {
    [advertiserId]: [
      (template: CampaignTemplate) => {
        template.id = campaignId;

        return template;
      },
    ],
  };

  const allAssignedTargetingOptions = {
    [advertiserId]: {
      [campaignId]: [
        ...geoTargets.map(
          (geoTarget, idx) =>
            new AssignedTargetingOption(
              `geo${idx}`,
              TARGETING_TYPE.GEO_REGION,
              '',
              '',
              {displayName: geoTarget},
            ),
        ),
        ...excludes.map(
          (geoTarget, idx) =>
            new AssignedTargetingOption(
              `ex${idx}`,
              TARGETING_TYPE.GEO_REGION,
              '',
              '',
              {displayName: geoTarget, negative: true},
            ),
        ),
      ],
    },
  };

  const {results} = await generateTestClient({
    id: advertiserId,
    allCampaigns,
    allInsertionOrders,
    allAssignedTargetingOptions,
  })
    .addRule(geoTargetRule, columns)
    .validate();

  return results['Geo Targeting'].values;
}

/**
 * Generates line item test data
 */
export async function generateLineItemTestData<
  Params extends Record<keyof Params, string>,
>({
  advertiserId,
  startDate,
  endDate,
  fakeSpendAmount,
  pacingType,
  columns,
  budget,
}: LineItemTestDataParams) {
  const LINE_ITEM_ID = 'li1';

  const allLineItems = {
    [advertiserId]: [
      (template: LineItemTemplate) => {
        template.id = LINE_ITEM_ID;
        template.advertiserId = advertiserId;
        template.pacing.pacingType = pacingType;
        template.flight.dateRange = {startDate, endDate};
        template.budget.maxAmount = budget;
        return template;
      },
    ],
  };

  const client = generateTestClient({
    id: advertiserId,
    allLineItems,
    fakeSpendAmount,
  });
  const addRule = client.addRule.bind(client) as (
    // simplification for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rule: any,
    paramMap: string[][],
  ) => Client;
  const {results} = await addRule(budgetPacingRuleLineItem, columns).validate();
  return Object.values(results)[0].values;
}

/**
 * Generates fake insertion order test data.
 */
export async function generateInsertionOrderTestData<
  Params extends Record<keyof Params, string>,
>(
  rule: RuleExecutorClass<DisplayVideoClientTypes, Params>,
  {
    advertiserId,
    insertionOrderBudgetSegments = [],
    fakeSpendAmount,
  }: InsertionOrderTestDataParams,
  params: string[][],
) {
  const INSERTION_ORDER_ID = 'io1';

  const allInsertionOrders = {
    [advertiserId]: [
      (template: InsertionOrderTemplate) => {
        template.id = INSERTION_ORDER_ID;
        template.budget.budgetSegments = insertionOrderBudgetSegments;
        template.advertiserId = advertiserId;
        return template;
      },
    ],
  };

  const client = generateTestClient({
    id: advertiserId,
    allInsertionOrders,
    fakeSpendAmount,
  });
  const addRule = client.addRule.bind(client) as (
    // simplified for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rule: any,
    paramMap: string[][],
  ) => Client;
  const {results} = await addRule(rule, params).validate();
  return Object.values(results)[0].values;
}

/**
 * Generates a fake impressions report
 */
export async function generateImpressionReport(
  rule: typeof impressionsByGeoTarget,
  fakeImpressionAmount: number,
) {
  const allCampaigns = {
    '123': [(template: CampaignTemplate) => template],
  };

  const allInsertionOrders = {
    '123': [
      (template: InsertionOrderTemplate) => {
        template.budget.budgetSegments.push({
          budgetAmountMicros: '100000',
          dateRange: {
            startDate: new ApiDate(1970, 1, 1),
            endDate: new ApiDate(1970, 1, 30),
          },
        });
        return template;
      },
    ],
  };

  const columns = [
    ['', 'Allowed Countries (Comma Separated)', 'Max. Percent Outside Geos'],
    ['default', 'US', '0.01'],
  ];
  const {results} = await generateTestClient({
    id: '123',
    allCampaigns,
    allInsertionOrders,
    fakeImpressionAmount,
  })
    .addRule(impressionsByGeoTarget, columns)
    .validate();

  return results['Impressions by Geo Target'].values;
}

/**
 * Generates a fake insertion order report.
 */
export async function generateInsertionOrderReportWithDateValues(
  startDate: number,
  endDate: number,
  includeInsertionOrderBudgetSegments = true,
) {
  return await generateInsertionOrderTestData(
    dailyBudgetRule,
    {
      advertiserId: '123',
      insertionOrderBudgetSegments: includeInsertionOrderBudgetSegments
        ? [
            {
              budgetAmountMicros: '100000',
              dateRange: {
                startDate: new ApiDate(1970, 1, startDate),
                endDate: new ApiDate(1970, 12, endDate),
              },
            },
          ]
        : [],
      fakeSpendAmount: 1,
    },
    [
      ['', 'Min. Days Ahead/Behind (+/-)', 'Max. Days Ahead/Behind (+/-)'],
      ['c1', '-1', '1'],
    ],
  );
}

/**
 * Generates a fake line item report.
 */
export async function generateLineItemReport(
  startDate: number,
  endDate: number,
) {
  return await generateLineItemTestData({
    advertiserId: '123',
    startDate: new ApiDate(1970, 1, startDate),
    endDate: new ApiDate(1970, 1, endDate),
    fakeSpendAmount: 1,
    budget: '100000',
    columns: [
      [
        '',
        'Min. Percent Ahead/Behind (+/-)',
        'Max. Percent Ahead/Behind (+/-)',
      ],
      ['c1', '-1', '1'],
    ],
  });
}

/**
 * Test data for the daily budget rule.
 */
export async function dailyBudgetRuleTestData(fakeTotalBudget: number) {
  return await generateInsertionOrderTestData(
    dailyBudgetRule,
    {
      advertiserId: '123',
      insertionOrderBudgetSegments: [
        {
          budgetAmountMicros: (fakeTotalBudget * 1_000_000).toString(),
          dateRange: {
            startDate: new ApiDate(1970, 1, 1),
            endDate: new ApiDate(1970, 1, 11),
          },
        },
        {
          budgetAmountMicros: (fakeTotalBudget * 2_000_000).toString(),
          dateRange: {
            startDate: new ApiDate(1, 1, 1),
            endDate: new ApiDate(1, 1, 11),
          },
        },
      ],
      fakeSpendAmount: fakeTotalBudget,
    },
    [
      ['', 'Min. Daily Budget', 'Max. Daily Budget'],
      ['default', '5', '10'],
    ],
  );
}

/**
 * Generates test data for the budget pacing rule for line items.
 */
export async function lineItemPacingRuleTestData(fakeSpendAmount: number) {
  return await generateLineItemTestData({
    advertiserId: '123',
    pacingType: PACING_TYPE.AHEAD,
    fakeSpendAmount,
    budget: (100_000_000).toString(),
    startDate: new ApiDate(1970, 1, 1),
    endDate: new ApiDate(1970, 1, 5),
    columns: [
      [
        '',
        'Min. Percent Ahead/Behind',
        'Max. Percent Ahead/Behind',
        'Pacing Type',
      ],
      ['default', '0', '0.5', 'PACING_TYPE_AHEAD'],
    ],
  });
}

/**
 * Generates test data for the budget pacing rule for insertion orders.
 */
export async function insertionOrderPacingRuleTestData(
  fakeSpendAmount: number,
) {
  return await generateInsertionOrderTestData(
    budgetPacingPercentageRule,
    {
      advertiserId: '123',
      insertionOrderBudgetSegments: [
        {
          budgetAmountMicros: (100_000_000).toString(),
          dateRange: {
            startDate: new ApiDate(1970, 1, 1),
            endDate: new ApiDate(1970, 1, 5),
          },
        },
      ],
      fakeSpendAmount,
    },
    [
      [
        '',
        'Min. Percent Ahead/Behind',
        'Max. Percent Ahead/Behind',
        'Pacing Type',
      ],
      ['io1', '0', '0.5', 'PACING_TYPE_AHEAD'],
    ],
  );
}
