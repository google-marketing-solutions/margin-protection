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
 * @fileoverview The test for the new SA360 rules.
 */

// g3-format-prettier

import {
  FakePropertyStore,
  mockAppsScript,
} from 'common/test_helpers/mock_apps_script';
import {bootstrapGoogleAdsApi} from 'common/tests/helpers';
import {
  ParamDefinition,
  RuleExecutor,
  Values,
} from 'common/types';
import {ClientV2} from 'sa360/src/client';
import {
  ClientArgsV2,
  ClientInterfaceV2,
  RuleGranularity,
} from 'sa360/src/types';

import {budgetPacingRule} from '../rules';

describe('Campaign pacing rule', () => {
  beforeEach(() => {
    mockAppsScript();
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    FakePropertyStore.clearCache();
  });

  it('shows pacing is OK when it is between min and max', async () => {
    const costs = [
      {budget: 100, spend: 90},
      {budget: 100, spend: 50},
    ];
    const value = await generateTestData(costs, [
      [
        'Campaign ID',
        'Campaign',
        'Min. Percent Ahead/Behind',
        'Max. Percent Ahead/Behind',
      ],
      ['default', '', '0', '1'],
      ['C1', '', '0.5', '1'],
      ['C2', '', '0.95', '1'],
    ]);
    expect(value['C1'].anomalous).toBeFalse();
    expect(value['C2'].anomalous).toBeTrue();
  });

  it('fails to pace when there is no cost', async () => {
    const costs = [{budget: 100}];
    const value = await generateTestData(costs, [
      [
        'Campaign ID',
        'Campaign',
        'Min. Percent Ahead/Behind',
        'Max. Percent Ahead/Behind',
      ],
      ['default', '', '0', '1'],
      ['C1', '', '0.5', '1'],
      ['C2', '', '0.95', '1'],
    ]);
    expect(value['C1'].fields['spend']).toEqual('0');
  });
});

/**
 *
 * Generates geo test data for the tests below.
 */
export async function generateTestData(
  pacings: Array<{budget: number; spend?: number}>,
  columns: string[][],
) {
  const {reportFactory, api} = bootstrapGoogleAdsApi();
  const client = new ClientV2(
    {
      customerIds: '1',
      label: 'test',
    },
    new FakePropertyStore(),
    reportFactory,
  );
  client.addRule(budgetPacingRule, columns);
  const obj = {
    campaign: {
      id: 'C1',
      name: 'Campaign 1',
      status: 'ACTIVE',
    },
    campaignBudget: {
      amountMicros: '1000000', // 1.00 USD
    },
  };

  let values: Values = {};
  const mockQuery = spyOn(api, 'query');
  for (const [i, {budget, spend}] of pacings.entries()) {
    obj.campaign.id = `C${i + 1}`;
    if (spend) {
      (obj as unknown as {metrics?: {costMicros?: string}}).metrics = {
        costMicros: `${spend * 1e6}`,
      };
    }
    obj.campaignBudget.amountMicros = `${budget * 1e6}`;
    mockQuery.and.returnValue(iterator(obj));
    const {results, rules} = await client.validate();
    writeBackToColumns(rules, columns);
    values = {...values, ...(results['Budget Pacing']?.values || {})};
  }
  return values;
}

function writeBackToColumns(
  rules: Record<
    string,
    RuleExecutor<
      ClientInterfaceV2,
      RuleGranularity,
      ClientArgsV2,
      Record<string, ParamDefinition>
    >
  >,
  columns: string[][],
) {
  for (const rule of Object.values(rules)) {
    for (let i = 1; i < columns.length; i++) {
      if (columns[i].slice(2).filter((c) => c).length) {
        continue;
      }
      columns[i] = [
        columns[i][0],
        columns[i][1],
        ...Object.values<string>(rule.settings.get(columns[i][0])),
      ];
    }
  }
}

function iterator<T>(...a: T[]): IterableIterator<T> {
  return a[Symbol.iterator]();
}
