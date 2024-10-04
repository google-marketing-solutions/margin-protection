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

import { ApiDate } from 'dv360_api/dv360_types';
import { AppsScriptPropertyStore } from 'common/sheet_helpers';
import { mockAppsScript } from 'common/test_helpers/mock_apps_script';
import { budgetPacingPercentageRule, impressionsByGeoTarget } from '../rules';
import {
  dailyBudgetRuleTestData,
  generateGeoTestData,
  generateImpressionReport,
  generateInsertionOrderTestData,
  generateLineItemTestData,
  insertionOrderPacingRuleTestData,
  lineItemPacingRuleTestData,
  generateLineItemReport,
  generateInsertionOrderReportWithDateValues,
} from './rules_test_helpers';

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
    expect(values['c1']).toEqual(
      jasmine.objectContaining({ anomalous: false }),
    );
  });

  it('triggers an error when a non-US geo is found', async () => {
    const values = await generateGeoTestData({
      advertiserId: '456',
      geoTargets: ['United States (Country)', 'Portugal (Country)'],
    });
    expect(values['c1']).toEqual(
      jasmine.objectContaining({
        value: '"Portugal (Country)" not an allowed target',
        anomalous: true,
      }),
    );
  });

  it('triggers an error when a negative match is found', async () => {
    const values = await generateGeoTestData({
      advertiserId: '456',
      excludes: ['United States (Country)'],
      columns: [
        [
          '',
          'Excluded Geo Targets',
          'Allowed Geo Targets',
          'Required Geo Targets',
        ],
        ['c1', 'United States', '', ''],
      ],
    });
    expect(values['c1']).toEqual(
      jasmine.objectContaining({
        value: '"United States (Country)" found and is an excluded target',
        anomalous: true,
      }),
    );
  });

  it('triggers an error when a required geo is not found', async () => {
    const values = await generateGeoTestData({
      advertiserId: '456',
      excludes: ['United States (Country)'],
      columns: [
        [
          '',
          'Required Geo Targets',
          'Allowed Geo Targets',
          'Excluded Geo Targets',
        ],
        ['c1', 'United Kingdom', '', ''],
      ],
    });
    expect(values['c1']).toEqual(
      jasmine.objectContaining({
        value: '"United Kingdom" was required but not targeted',
        anomalous: true,
      }),
    );
  });

  it('triggers an error when an excluded geo is set but there is no targeting', async () => {
    const values = await generateGeoTestData({
      advertiserId: '456',
      columns: [
        [
          '',
          'Required Geo Targets',
          'Allowed Geo Targets',
          'Excluded Geo Targets',
        ],
        ['c1', '', '', 'United States'],
      ],
    });
    expect(values['c1']).toEqual(
      jasmine.objectContaining({ value: 'No targeting set', anomalous: true }),
    );
  });

  it('triggers an error when an allowed geo is set but there is no targeting', async () => {
    const values = await generateGeoTestData({
      advertiserId: '456',
      columns: [
        [
          '',
          'Required Geo Targets',
          'Allowed Geo Targets',
          'Excluded Geo Targets',
        ],
        ['c1', '', 'United States', ''],
      ],
    });
    expect(values['c1']).toEqual(
      jasmine.objectContaining({ value: 'No targeting set', anomalous: true }),
    );
  });
});

describe('Percentage Budget Pacing Rule (Insertion Order)', () => {
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

  const tests: Array<
    [operator: string, fakeSpendAmount: number, testValue: string]
  > = [
    ['is below', 10, '-80% (< 0%)'],
    ['is above', 100, '100% (> 50%)'],
  ];

  for (const [operator, fakeSpendAmount, value] of tests) {
    it(`fails when pacing ${operator} threshold`, async () => {
      const values = await insertionOrderPacingRuleTestData(fakeSpendAmount);
      expect(values['io1']).toEqual(
        jasmine.objectContaining({
          value,
          anomalous: true,
        }),
      );
    });
  }
  it(`doesn't fail when pacing is equal to threshold`, async () => {
    const values = await insertionOrderPacingRuleTestData(50);
    expect(values['io1']).toEqual(
      jasmine.objectContaining({ anomalous: false, value: 'Pace OK' }),
    );
  });

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
        Budget: '$100',
        Spend: '$50',
        Pacing: '100%',
        'Days Elapsed': '2',
        'Flight Duration': '4',
      }),
    );
  });
});

describe('Percentage Budget Pacing Rule (Line Item)', () => {
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
      const values = await generateLineItemReport(startDate, endDate);
      expect(values).toEqual({});
    });
  }

  it('checks rules when in date range', async () => {
    const values = await generateLineItemReport(1, 6);
    expect(values).toEqual({
      li1: jasmine.objectContaining({
        anomalous: true,
      }),
    });
  });

  const tests: Array<
    [operator: string, fakeSpendAmount: number, testValue: string]
  > = [
    ['is below', 10, '-80% (< 0%)'],
    ['is above', 100, '100% (> 50%)'],
  ];

  for (const [operator, fakeSpendAmount, value] of tests) {
    it(`fails when pacing ${operator} threshold`, async () => {
      const values = await lineItemPacingRuleTestData(fakeSpendAmount);
      expect(values['li1']).toEqual(
        jasmine.objectContaining({
          value,
          anomalous: true,
        }),
      );
    });
  }

  it(`doesn't fail when pacing is equal to threshold`, async () => {
    const values = await lineItemPacingRuleTestData(50);
    expect(values['li1']).toEqual(
      jasmine.objectContaining({ anomalous: false, value: 'Pace OK' }),
    );
  });

  it('has the correct fields and values', async () => {
    const values = await generateLineItemTestData({
      advertiserId: '123',
      startDate: new ApiDate(1970, 1, 1),
      endDate: new ApiDate(1970, 1, 5),
      fakeSpendAmount: 50,
      budget: (100_000_000).toString(),
      columns: [
        [
          '',
          'Min. Percent Ahead/Behind',
          'Max. Percent Ahead/Behind',
          'Pacing Type',
        ],
        ['io1', '-10', '-10', 'PACING_TYPE_AHEAD'],
      ],
    });

    expect(values['li1'].fields).toEqual(
      jasmine.objectContaining({
        'Line Item ID': 'li1',
        'Display Name': 'Line Item 1',
        Budget: '$100',
        Spend: '$50',
        Pacing: '100%',
        'Days Elapsed': '2',
        'Flight Duration': '4',
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
  for (const [operator, fakeTotalBudget, value, anomalous] of tests) {
    if (anomalous) {
      it(`fails when daily budgets ${operator} range`, async () => {
        const values = await dailyBudgetRuleTestData(fakeTotalBudget);
        expect(values['io1']).toEqual(
          jasmine.objectContaining({
            value,
            anomalous,
          }),
        );
      });
    } else {
      it(`doesn't fail when daily budgets ${operator} range`, async () => {
        const values = await dailyBudgetRuleTestData(fakeTotalBudget);
        expect(values['io1']).toEqual(
          jasmine.objectContaining({ anomalous: false }),
        );
      });
    }

    const values: Array<[startDate: number, endDate: number]> = [
      [1, 30],
      [1, 6],
    ];
    for (const [startDate, endDate] of values) {
      it(`checks rules when in date range (${startDate}-${endDate})`, async () => {
        const values = await generateInsertionOrderReportWithDateValues(
          startDate,
          endDate,
        );
        expect(values).toEqual({
          io1: jasmine.objectContaining({
            anomalous: true,
          }),
        });
      });
    }

    it('skips rules when out of date range', async () => {
      jasmine.clock().mockDate(new Date('3000-01-01'));
      const values = await generateInsertionOrderReportWithDateValues(1, 1);
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
      io1: jasmine.objectContaining({
        anomalous: true,
      }),
    });
  });
});
