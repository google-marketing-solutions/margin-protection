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

import { describe, beforeEach, it, expect } from 'vitest';
import { mockAppsScript } from '#common/test_helpers/mock_apps_script.js';
import { FakePropertyStore } from '#common/test_helpers/mock_apps_script.js';
import {
  FakeClient,
  Granularity,
  RuleRange,
  TestClientInterface,
} from '#common/tests/helpers.js';
import { HELPERS } from '../helpers.js';

describe('RuleRange', function () {
  let rules: RuleRange;

  beforeEach(function () {
    const client = generateTestClient({ id: '1' });
    rules = initializeRuleRange(client);
    for (const rule of ['', 'Category A', 'Category B', 'Category C']) {
      // getValues() expects a rule to be in the ruleStore for the helper value.
      client.ruleStore[rule] = {
        helper: '',
        granularity: 'default',
      } as unknown as (typeof client.ruleStore)[keyof typeof client.ruleStore];
    }
  });

  it('break down a settings sheet into the correct categories', function () {
    expect(
      (
        rules as unknown as {
          rules: Record<string, Array<string[] | undefined>>;
        }
      ).rules,
    ).toEqual({
      none: [['id', 'name'], undefined, ['1', 'one']],
      'Category A': [['Header 1', 'Header 2'], undefined, ['Col 1', 'Col 2']],
      'Category B': [
        ['Header 3', 'Header 4', 'Header 5'],
        undefined,
        ['Col 3', 'Col 4', 'Col 5'],
      ],
      'Category C': [['Header 6'], undefined, ['Col 6']],
    });
  });

  it('combines categories back into a settings sheet', function () {
    expect(rules.getRule('Category A')).toEqual([
      ['id', 'Header 1', 'Header 2'],
      ['1', 'Col 1', 'Col 2'],
    ]);
  });

  it('writes back to the spreadsheet - base case', function () {
    mockAppsScript();
    rules.writeBack(Granularity.DEFAULT);
    const expected = [
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
    ];
    const range = HELPERS.getOrCreateSheet(`Rule Settings - default`).getRange(
      1,
      1,
      expected.length,
      expected[0].length,
    );
    expect(range.getValues()).toEqual(expected);
  });

  it('writes back to the spreadsheet - cares about changes', function () {
    mockAppsScript();
    const sheet = HELPERS.getOrCreateSheet('Rule Settings - default');
    rules.writeBack(Granularity.DEFAULT);
    const expected = [
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
    ];
    const range = sheet.getRange(1, 1, expected.length, expected[0].length);
    expected[3][2] = 'New Col 1';
    range.setValues(expected);
    rules.writeBack(Granularity.DEFAULT);

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
      ['1', 'one', 'New Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'],
    ]);
  });
});

function generateTestClient(params: { id?: string }): TestClientInterface {
  return new FakeClient(params.id, new FakePropertyStore());
}

function initializeRuleRange(client: TestClientInterface) {
  return new RuleRange(
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
}
