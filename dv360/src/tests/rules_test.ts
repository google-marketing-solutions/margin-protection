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

import {AssignedTargetingOption} from 'dv360_api/dv360_resources';
import {
  ApiDate,
  TARGETING_TYPE,
} from 'dv360_api/dv360_types';
import {AppsScriptPropertyStore} from 'common/sheet_helpers';
import {mockAppsScript} from 'common/test_helpers/mock_apps_script';
import {RuleExecutorClass} from 'common/types';
import {Client} from '../client';
import {
  budgetPacingDaysAheadRule,
  budgetPacingPercentageRule,
  dailyBudgetRule,
  geoTargetRule,
  impressionsByGeoTarget,
} from '../rules';
import {ClientArgs, ClientInterface, RuleGranularity} from '../types';

import {
  CampaignTemplate,
  generateTestClient,
  GeoTargetTestDataParams,
  InsertionOrderTemplate,
  InsertionOrderTestDataParams,
} from './client_helpers';

describe('Geo targeting Rule', () => {
  beforeEach(() => {
    mockAppsScript();
    jasmine.clock().install().mockDate(new Date('1970-01-01'));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('passes when geo is in the US', async () => {
    const values = await generateGeoTestData({
      advertiserId: '123',
      geoTargets: ['United States (Country)'],
    });
    expect(values['c1']).toEqual(jasmine.objectContaining({anomalous: false}));
  });

  it('triggers an error when a non-US geo is found', async () => {
    const values = await generateGeoTestData({
      advertiserId: '456',
      geoTargets: ['United States (Country)', 'Portugal (Country)'],
    });
    expect(values['c1']).toEqual(
      jasmine.objectContaining({value: '0', anomalous: true}),
    );
  });

  it('triggers an error when a negative match is found', async () => {
    const values = await generateGeoTestData({
      advertiserId: '456',
      excludes: ['United States (Country)'],
      columns: [
        ['', 'Geo Targets', 'Excluded Geo Targets'],
        ['c1', '', 'United States'],
      ],
    });
    expect(values['c1']).toEqual(
      jasmine.objectContaining({value: '0', anomalous: true}),
    );
  });

  it('triggers an error when no geo is found', async () => {
    const values = await generateGeoTestData({advertiserId: '789'});
    expect(values['c1']).toEqual(
      jasmine.objectContaining({value: '0', anomalous: true}),
    );
  });
});

async function generateReportWithDateValues(
  rule: typeof budgetPacingDaysAheadRule | typeof dailyBudgetRule,
  startDate: number,
  endDate: number,
  includeInsertionOrderBudgetSegments = true,
) {
  return await generateInsertionOrderTestData(
    rule,
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

async function generateImpressionReport(
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

describe('Percentage Budget Pacing Rule', () => {
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(1970, 0, 3));
    mockAppsScript();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    (
      AppsScriptPropertyStore as unknown as {
        cache: Record<string, string>;
      }
    ).cache = {};
  });

  const parameters: Array<[startDate: number, endDate: number]> = [
    [1, 2],
    [5, 6],
  ];
  for (const [startDate, endDate] of parameters) {
    it(`skips rule when out of date range (${startDate} < 4 < ${endDate})`, async () => {
      const values = await generateReportWithDateValues(
        budgetPacingPercentageRule,
        startDate,
        endDate,
        false,
      );
      expect(values).toEqual({});
    });
  }

  it('checks rules when in date range', async () => {
    const values = await generateReportWithDateValues(
      budgetPacingPercentageRule,
      1,
      6,
    );
    expect(values).toEqual({
      'io1': jasmine.objectContaining({
        anomalous: true,
      }),
    });
  });

  const tests: Array<
    [
      operator: string,
      fakeSpendAmount: number,
      testValue: string,
      anomalous: boolean,
    ]
  > = [
    ['is below', 10, '-0.8', true],
    ['is equal to', 50, '0', false],
    ['is above', 100, '1', true],
  ];

  async function testData(fakeSpendAmount: number) {
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
        ['', 'Min. Percent Ahead/Behind', 'Max. Percent Ahead/Behind'],
        ['io1', '0', '0.5'],
      ],
    );
  }

  for (const [operator, fakeSpendAmount, value, anomalous] of tests) {
    if (anomalous) {
      it(`fails when pacing ${operator} threshold`, async () => {
        const values = await testData(fakeSpendAmount);
        expect(values['io1']).toEqual(
          jasmine.objectContaining({
            value,
            anomalous,
          }),
        );
      });
    } else {
      it(`doesn't fail when pacing ${operator} threshold`, async () => {
        const values = await testData(fakeSpendAmount);
        expect(values['io1']).toEqual(
          jasmine.objectContaining({anomalous: false}),
        );
      });
    }
  }

  it('has the correct fields and values', async () => {
    const values = await generateInsertionOrderTestData(
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
        fakeSpendAmount: 50,
      },
      [
        ['', 'Min. Percent Ahead/Behind', 'Max. Percent Ahead/Behind'],
        ['io1', '-10', '-10'],
      ],
    );

    expect(values['io1'].fields).toEqual(
      jasmine.objectContaining({
        'Insertion Order ID': 'io1',
        'Display Name': 'Insertion Order 1',
        'Budget': '$100',
        'Spend': '$50',
        'Pacing': '100%',
        'Days Elapsed': '2',
        'Flight Duration': '4',
      }),
    );
  });
});

describe('Daily Budget Pacing Rule', () => {
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(1970, 0, 4));
    mockAppsScript();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  const parameters: Array<[startDate: number, endDate: number]> = [
    [1, 2],
    [5, 6],
  ];
  for (const [startDate, endDate] of parameters) {
    it(`skips rule when out of date range (${startDate} < 4 < ${endDate})`, async () => {
      const values = await generateReportWithDateValues(
        budgetPacingDaysAheadRule,
        startDate,
        endDate,
        false,
      );
      expect(values).toEqual({});
    });
  }

  it('checks rules when in date range', async () => {
    const values = await generateReportWithDateValues(
      budgetPacingDaysAheadRule,
      1,
      6,
    );
    expect(values).toEqual({
      'io1': jasmine.objectContaining({
        anomalous: true,
      }),
    });
  });

  const tests: Array<
    [
      operator: string,
      fakeSpendAmount: number,
      testValue: string,
      anomalous: boolean,
    ]
  > = [
    ['is below', 10, '-2', true],
    ['is equal to', 30, '0', false],
    ['is above', 50, '2', true],
  ];

  async function testData(fakeSpendAmount: number) {
    return await generateInsertionOrderTestData(
      budgetPacingDaysAheadRule,
      {
        advertiserId: '123',
        insertionOrderBudgetSegments: [
          {
            budgetAmountMicros: (100_000_000).toString(),
            dateRange: {
              startDate: new ApiDate(1970, 1, 1),
              endDate: new ApiDate(1970, 1, 11),
            },
          },
        ],
        fakeSpendAmount,
      },
      [
        ['', 'Min. Days Ahead/Behind (+/-)', 'Max. Days Ahead/Behind (+/-)'],
        ['io1', '-1', '1'],
      ],
    );
  }
  for (const [operator, fakeSpendAmount, value, anomalous] of tests) {
    if (anomalous) {
      it(`fails when pacing ${operator} threshold`, async () => {
        const values = await testData(fakeSpendAmount);
        expect(values['io1']).toEqual(
          jasmine.objectContaining({
            value,
            anomalous,
          }),
        );
      });
    } else {
      it(`doesn't fail when pacing ${operator} threshold`, async () => {
        const values = await testData(fakeSpendAmount);
        expect(values['io1']).toEqual(
          jasmine.objectContaining({anomalous: false}),
        );
      });
    }
  }
  it('Uses the provided parameters', async () => {
    const values = await generateInsertionOrderTestData(
      budgetPacingDaysAheadRule,
      {
        advertiserId: '123',
        insertionOrderBudgetSegments: [
          {
            budgetAmountMicros: (100_000_000).toString(),
            dateRange: {
              startDate: new ApiDate(1970, 1, 1),
              endDate: new ApiDate(1970, 1, 11),
            },
          },
        ],
        fakeSpendAmount: 30,
      },
      [
        ['', 'Min. Days Ahead/Behind (+/-)', 'Max. Days Ahead/Behind (+/-)'],
        ['default', '-10', '-9'],
      ],
    );
    expect(values['io1']).toEqual(
      jasmine.objectContaining({
        value: '0',
        anomalous: true,
      }),
    );
  });
});

describe('Daily Budgets Rule', () => {
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(1970, 0, 2));
    mockAppsScript();
  });

  afterEach(() => {
    PropertiesService.getScriptProperties().deleteAllProperties();
    jasmine.clock().uninstall();
  });

  const tests: Array<
    [
      operator: string,
      fakeTotalBudget: number,
      value: string,
      anomalous: boolean,
    ]
  > = [
    ['is below', 20, '2', true],
    ['is equal to', 50, '5', false],
    ['is above', 120, '12', true],
  ];
  async function testData(fakeTotalBudget: number) {
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
  for (const [operator, fakeTotalBudget, value, anomalous] of tests) {
    if (anomalous) {
      it(`fails when daily budgets ${operator} range`, async () => {
        const values = await testData(fakeTotalBudget);
        expect(values['io1']).toEqual(
          jasmine.objectContaining({
            value,
            anomalous,
          }),
        );
      });
    } else {
      it(`doesn't fail when daily budgets ${operator} range`, async () => {
        const values = await testData(fakeTotalBudget);
        expect(values['io1']).toEqual(
          jasmine.objectContaining({anomalous: false}),
        );
      });
    }

    const values: Array<[startDate: number, endDate: number]> = [
      [1, 30],
      [1, 6],
    ];
    for (const [startDate, endDate] of values) {
      it(`checks rules when in date range (${startDate}-${endDate})`, async () => {
        const values = await generateReportWithDateValues(
          dailyBudgetRule,
          startDate,
          endDate,
        );
        expect(values).toEqual({
          'io1': jasmine.objectContaining({
            anomalous: true,
          }),
        });
      });
    }

    it('skips rules when out of date range', async () => {
      jasmine.clock().mockDate(new Date('3000-01-01'));
      const values = await generateReportWithDateValues(dailyBudgetRule, 1, 1);
      expect(values).toEqual({});
    });
  }
});

describe('impressionsByGeoTarget', () => {
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(1970, 0, 2));
    mockAppsScript();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('checks rules when in date range', async () => {
    const values = await generateImpressionReport(impressionsByGeoTarget, 1);
    expect(values).toEqual({
      'io1': jasmine.objectContaining({
        anomalous: true,
      }),
    });
  });
});

/**
 *
 * Generates geo test data for the tests below.
 */
export async function generateGeoTestData({
  advertiserId,
  geoTargets = [],
  excludes = [],
  columns = [
    ['', 'Geo Targets', 'Excluded Geo Targets'],
    ['default', 'United Kingdom, United States', ''],
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
              {'displayName': geoTarget},
            ),
        ),
        ...excludes.map(
          (geoTarget, idx) =>
            new AssignedTargetingOption(
              `ex${idx}`,
              TARGETING_TYPE.GEO_REGION,
              '',
              '',
              {'displayName': geoTarget, 'negative': true},
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

async function generateInsertionOrderTestData<
  Params extends Record<keyof Params, string>,
>(
  rule: RuleExecutorClass<ClientInterface, RuleGranularity, ClientArgs, Params>,
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
    // tslint:disable-next-line:no-any simplification for testing
    rule: any,
    paramMap: string[][],
  ) => Client;
  const {results} = await addRule(rule, params).validate();
  return Object.values(results)[0].values;
}
