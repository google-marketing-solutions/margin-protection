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

import {
  FakePropertyStore,
  mockAppsScript,
} from 'anomaly_library/testing/mock_apps_script';
import {ParamDefinition} from 'common/types';

import {
  getOrCreateSheet,
  HELPERS,
  SettingMap,
  sortMigrations,
  transformToParamValues,
} from '../sheet_helpers';
import {RuleExecutorClass} from '../types';

import {
  Granularity,
  RuleRange,
  TestClientArgs,
  TestClientInterface,
} from './helpers';

describe('2-D array', () => {
  let array2d: string[][];
  const params = {'rule1': {label: 'Rule 1'}, 'rule2': {label: 'Rule 2'}};

  beforeEach(() => {
    array2d = [
      ['', 'Rule 1', 'Rule 2'],
      ['1', 'A', 'B'],
      ['2', 'C', 'D'],
    ];
  });

  it('transforms into a param', () => {
    expect(transformToParamValues(array2d, params)).toEqual(
      new SettingMap([
        ['1', {rule1: 'A', rule2: 'B'}],
        ['2', {rule1: 'C', rule2: 'D'}],
      ]),
    );
  });

  it('triggers an error if empty', () => {
    const error = new Error(
      'Expected a grid with row and column headers of at least size 2',
    );
    expect(() => transformToParamValues([], params)).toThrow(error);
    expect(() => transformToParamValues([[]], params)).toThrow(error);
    expect(() => transformToParamValues([['']], params)).toThrow(error);
  });
});

describe('Rule Settings helper functions', () => {
  let rules: RuleRange;

  const client = generateTestClient({id: '1'});
  beforeEach(() => {
    rules = new RuleRange(
      [
        ['', '', 'Category A', '', 'Category B', '', '', 'Category C'],
        [
          'id',
          'name',
          'Header 1',
          'Header 2',
          'Header 3',
          'Header 4',
          'Header 5',
          'Header 6',
        ],
        ['1', 'one', 'Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'],
      ],
      client,
      ['id'],
    );
    for (const rule of ['', 'Category A', 'Category B', 'Category C']) {
      // getValues() expects a rule to be in the ruleStore for the helper value.
      client.ruleStore[rule] = {
        helper: '',
        granularity: 'default',
      } as unknown as (typeof client.ruleStore)[keyof typeof client.ruleStore];
    }
  });

  it('break down a settings sheet into the correct categories', () => {
    expect(
      (rules as unknown as {rules: Record<string, string[][]>}).rules,
    ).toEqual({
      'none': [
        ['id', 'name'],
        ['1', 'one'],
      ],
      'Category A': [
        ['Header 1', 'Header 2'],
        ['Col 1', 'Col 2'],
      ],
      'Category B': [
        ['Header 3', 'Header 4', 'Header 5'],
        ['Col 3', 'Col 4', 'Col 5'],
      ],
      'Category C': [['Header 6'], ['Col 6']],
    });
  });

  it('combines categories back into a settings sheet', () => {
    expect(rules.getRule('Category A')).toEqual([
      ['id', 'Header 1', 'Header 2'],
      ['1', 'Col 1', 'Col 2'],
    ]);
  });

  it('writes back to the spreadsheet', () => {
    mockAppsScript();
    rules.writeBack(Granularity.DEFAULT);
    const range = getOrCreateSheet(`Rule Settings - default`).getDataRange();
    expect(range.getValues()).toEqual([
      ['', '', 'Category A', '', 'Category B', '', '', 'Category C'],
      ['', '', '', '', '', '', '', ''],
      [
        'id',
        'name',
        'Header 1',
        'Header 2',
        'Header 3',
        'Header 4',
        'Header 5',
        'Header 6',
      ],
      ['1', 'one', 'Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'],
    ]);
  });
});

describe('SettingMap#getOrDefault', () => {
  it('returns value', () => {
    const settingMap = new SettingMap([
      ['default', {rule1: 'A'}],
      ['1', {rule1: 'C'}],
    ]);
    expect(settingMap.getOrDefault('1').rule1).toEqual('C');
  });

  it('returns defaults when value is blank', () => {
    const settingMap = new SettingMap([
      ['default', {rule1: 'A'}],
      ['1', {rule1: ''}],
    ]);
    expect(settingMap.getOrDefault('1').rule1).toEqual('A');
  });

  it('returns value when value is 0', () => {
    const settingMap = new SettingMap([
      ['default', {rule1: 'A'}],
      ['1', {rule1: '0'}],
    ]);
    expect(settingMap.getOrDefault('1').rule1).toEqual('0');
  });

  it('returns blank when default is undefined and value is blank', () => {
    const settingMap = new SettingMap([['1', {rule1: ''}]]);
    expect(settingMap.getOrDefault('1').rule1).toEqual('');
  });
});

describe('sortMigrations', () => {
  it('sorts migrations as expected', () => {
    expect(['0.6', '1.2', '1.0'].sort(sortMigrations)).toEqual([
      '0.6',
      '1.0',
      '1.2',
    ]);
  });

  it('manages incremental versions', () => {
    expect(['0.6.1', '0.6', '1.0'].sort(sortMigrations)).toEqual([
      '0.6',
      '0.6.1',
      '1.0',
    ]);
  });

  it('works with objects', () => {
    expect(
      Object.entries({'0.1': 'b', '0.0.1': 'a'}).sort((e1, e2) =>
        sortMigrations(e1[0], e2[0]),
      ),
    ).toEqual([
      ['0.0.1', 'a'],
      ['0.1', 'b'],
    ]);
  });
});

describe('test HELPERS', () => {
  beforeEach(() => {
    mockAppsScript();
  });

  it('saveLastReportPull', () => {
    HELPERS.saveLastReportPull(1);
    expect(CacheService.getScriptCache().get('scriptPull')).toEqual('1');
    const expirationInSeconds = (
      CacheService.getScriptCache() as unknown as {
        expirationInSeconds: number | undefined;
      }
    ).expirationInSeconds;
    expect(expirationInSeconds).toBeUndefined();
  });

  it('getLastReportPull', () => {
    CacheService.getScriptCache().put('scriptPull', '10');
    expect(HELPERS.getLastReportPull()).toEqual(10);
  });
});

function generateTestClient(params: {id?: string}): TestClientInterface {
  return {
    id: params.id ?? '1',
    ruleStore: {},
    async getAllCampaigns() {
      return [];
    },
    getRule(ruleName: string) {
      throw new Error('Not implemented.');
    },
    validate() {
      throw new Error('Not implemented.');
    },
    addRule: <P extends Record<keyof P, ParamDefinition>>(
      rule: RuleExecutorClass<
        TestClientInterface,
        Granularity,
        TestClientArgs,
        {}
      >,
    ): TestClientInterface => {
      throw new Error('Not implemented.');
    },
    settings: {},
    getUniqueKey(prefix: string) {
      throw new Error('Not implemented.');
    },
    properties: new FakePropertyStore(),
  };
}
