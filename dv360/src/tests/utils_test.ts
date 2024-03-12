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
  SettingMap,
  transformToParamValues,
} from 'common/sheet_helpers';
import {RuleRange, getDate} from '../client';

import {mockAppsScript} from 'common/test_helpers/mock_apps_script';
import {generateTestClient} from './client_helpers';

describe('transformToParamValues', () => {
  let array2d: string[][];
  const params = {'rule1': {label: 'Rule 1'}, 'rule2': {label: 'Rule 2'}};

  beforeEach(() => {
    array2d = [
      ['', 'Rule 1', 'Rule 2'],
      ['1', 'A', 'B'],
      ['2', 'C', 'D'],
    ];
  });

  it('returns expected SettingMap', () => {
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

describe('Rule Settings helper functions', () => {
  let rules: RuleRange;

  let client;
  beforeEach(() => {
    mockAppsScript();
    client = generateTestClient({id: '1'});
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
    );
    for (const rule of ['', 'Category A', 'Category B', 'Category C']) {
      // getValues() expects a rule to be in the ruleStore for the helper value.
      client.ruleStore[rule] = {
        helper: '',
      } as unknown as (typeof client.ruleStore)[keyof typeof client.ruleStore];
    }
  });

  it('break down a settings sheet into the correct categories', () => {
    const rule = Object.fromEntries(
      Object.entries(
        (
          rules as unknown as {
            rules: Record<string, Array<string[] | undefined>>;
          }
        ).rules,
      )
        .map(([k, v]) => {
          return [k, v.slice(3)];
        })
        .filter((r) => r),
    );
    expect(rule).toEqual({
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
    expect(
      rules
        .getValues()
        .filter((row, i) => i < 2 || row.filter((c) => c).length > 1),
    ).toEqual([
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

describe('date function', () => {
  it('converts raw API date to real date with month correct', () => {
    const date = getDate({year: 2022, month: 2, day: 1});
    expect(date).toEqual(new Date('February 1, 2022'));
  });
});
