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

import {AbsoluteRule} from 'anomaly_library/absoluteRule';
import {AppsScriptPropertyStore} from 'anomaly_library/main';
import {mockAppsScript} from 'anomaly_library/testing/mock_apps_script';
import {
  Client,
  newRule,
} from 'sa360/src/client';
import {RuleGranularity} from 'sa360/src/types';

describe('Client rules are validated', () => {
  let output: string[] = [];
  let rule: AbsoluteRule<string>;
  let client: Client;
  const defaultGrid = [
    ['', 'param1', 'param2'],
    ['default', '1', '2'],
  ];

  beforeEach(() => {
    mockAppsScript();
    client = generateTestClient({agencyId: '123'});
    rule = new AbsoluteRule(
      {thresholdValue: 42, uniqueKey: 'uniq', propertyStore: client.properties},
      (thresholdValue) => (value) => Number(value) === thresholdValue,
    );

    const returnValue = {
      rule,
      values: {'1': rule.createValue(1), '42': rule.createValue(42)},
    };
    client.addRule(
      newRule({
        params: {},
        name: 'ruleA',
        description: ``,
        uniqueKeyPrefix: 'ruleA',
        granularity: RuleGranularity.CAMPAIGN,
        valueFormat: {label: 'ruleA'},
        async callback() {
          output.push('ruleA');
          return returnValue;
        },
        defaults: {},
      }),
      defaultGrid,
    );
    client.addRule(
      newRule({
        params: {},
        name: 'ruleB',
        description: ``,
        uniqueKeyPrefix: 'ruleB',
        granularity: RuleGranularity.CAMPAIGN,
        valueFormat: {label: 'ruleB'},
        async callback() {
          output.push('ruleB');
          return returnValue;
        },
        defaults: {},
      }),
      defaultGrid,
    );
  });

  afterEach(() => {
    output = [];
  });

  it('should not run rules until validate() is run', () => {
    expect(output).toEqual([]);
  });

  it('should run rules when validate() is run', async () => {
    await client.validate();
    expect(output).toEqual(['ruleA', 'ruleB']);
  });

  it('should have rule results after validate() is run', async () => {
    const {results} = await client.validate();
    expect(
      Object.values(results['ruleA'].values).map((value) => value.anomalous),
    ).toEqual([true, false]);
  });
});

function generateTestClient({
  agencyId = '1',
  advertiserId = undefined,
}: {
  agencyId?: string;
  advertiserId?: string;
}): Client {
  const client = new Client(
    {agencyId, advertiserId},
    new AppsScriptPropertyStore(),
  );

  return client;
}
