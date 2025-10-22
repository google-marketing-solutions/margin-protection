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

import { ApiDate } from 'dv360_api/dv360_types.js';
import { AppsScriptPropertyStore } from '#common/sheet_helpers/index.js';
import { mockAppsScript } from '#common/test_helpers/mock_apps_script.js';
import {
  budgetPacingPercentageRule,
  impressionsByGeoTarget,
} from '../rules.js';
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
} from './rules_test_helpers.js';
import { afterEach, beforeEach, describe, it, vi, expect } from 'vitest';

describe('Geo targeting Rule', () => {
  beforeEach(() => {
    mockAppsScript();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('1970-01-01'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes when geo is in the US', async () => {
    const values = await generateGeoTestData({
      advertiserId: '123',
      geoTargets: ['United States (Country)'],
    });
    expect(values['c1']).to.include({ anomalous: false });
  });

  it('triggers an error when a non-US geo is found', async () => {
    const values = await generateGeoTestData({
      advertiserId: '456',
      geoTargets: ['United States (Country)', 'Portugal (Country)'],
    });
    expect(values['c1']).to.include({
      value: '"Portugal (Country)" not an allowed target',
      anomalous: true,
    });
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
    expect(values['c1']).to.include({
      value: '"United States (Country)" found and is an excluded target',
      anomalous: true,
    });
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
    expect(values['c1']).to.include({
      value: '"United Kingdom" was required but not targeted',
      anomalous: true,
    });
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
    expect(values['c1']).to.include({
      value: 'No targeting set',
      anomalous: true,
    });
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
    expect(values['c1']).to.include({
      value: 'No targeting set',
      anomalous: true,
    });
  });
});

describe('Percentage Budget Pacing Rule (Insertion Order)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1970, 0, 3));
  });

  afterEach(() => {
    vi.useRealTimers();
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
      expect(values['io1']).to.include({
        value,
        anomalous: true,
      });
    });
  }

  it(`doesn't fail when pacing is equal to threshold`, async () => {
    const values = await insertionOrderPacingRuleTestData(50);
    expect(values['io1']).to.include({ anomalous: false, value: 'Pace OK' });
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

    expect(values['io1'].fields).to.include({
      'Insertion Order ID': 'io1',
      'Display Name': 'Insertion Order 1',
      Budget: '$100',
      Spend: '$50',
      Pacing: '100%',
      'Days Elapsed': '2',
      'Flight Duration': '4',
    });
  });
});

describe('Percentage Budget Pacing Rule (Line Item)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1970, 0, 3));
    mockAppsScript();
  });

  afterEach(() => {
    vi.useRealTimers();
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
      expect(values).to.eql({});
    });
  }

  it('checks rules when in date range', async () => {
    const values = await generateLineItemReport(1, 6);
    expect(values['li1']).to.include({
      anomalous: true,
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
      expect(values['li1']).to.include({
        value,
        anomalous: true,
      });
    });
  }

  it(`doesn't fail when pacing is equal to threshold`, async () => {
    const values = await lineItemPacingRuleTestData(50);
    expect(values['li1']).to.include({ anomalous: false, value: 'Pace OK' });
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

    expect(values['li1'].fields).to.include({
      'Line Item ID': 'li1',
      'Display Name': 'Line Item 1',
      Budget: '$100',
      Spend: '$50',
      Pacing: '100%',
      'Days Elapsed': '2',
      'Flight Duration': '4',
    });
  });
});

describe('Daily Budgets Rule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1970, 0, 2));
  });

  afterEach(() => {
    vi.useRealTimers();
    PropertiesService.getScriptProperties().deleteAllProperties();
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
    ['is above', 120, '12', true],
  ];
  for (const [operator, fakeTotalBudget, value, anomalous] of tests) {
    it(`fails when daily budgets ${operator} range`, async () => {
      const values = await dailyBudgetRuleTestData(fakeTotalBudget);
      expect(values['io1']).to.include({
        value,
        anomalous,
      });
    });
  }

  it(`doesn't fail when daily budgets is equal to range`, async () => {
    const values = await dailyBudgetRuleTestData(50);
    expect(values['io1']).to.include({ value: '5', anomalous: false });
  });

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
      expect(values['io1']).to.include({
        anomalous: true,
      });
    });
  }

  it('skips rules when out of date range', async () => {
    vi.setSystemTime(new Date('3000-01-01'));
    const values = await generateInsertionOrderReportWithDateValues(1, 1);
    expect(values).to.eql({});
  });
});

describe('impressionsByGeoTarget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1970, 0, 2));
    mockAppsScript();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks rules when in date range', async () => {
    const values = await generateImpressionReport(impressionsByGeoTarget, 1);
    expect(values['io1']).to.include({
      anomalous: true,
    });
  });
});
