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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { equalTo } from 'common/checks';
import { mockAppsScript } from 'common/test_helpers/mock_apps_script';
import { RecordInfo, Value } from 'common/types';

import { Client, newRule, RuleRange } from '../client';
import { RuleGranularity } from '../types';

import { generateTestClient, TestClient } from './client_helpers';
import {
  budgetPacingPercentageRule,
  budgetPacingRuleLineItem,
  geoTargetRule,
} from '../rules';
import { scaffoldSheetWithNamedRanges } from 'common/tests/helpers';

describe('Client rules are validated', () => {
  let output: string[] = [];
  const test = 42;
  let client: Client;
  const defaultGrid = [
    ['', 'param1', 'param2'],
    ['default', '1', '2'],
  ];

  beforeEach(() => {
    mockAppsScript();
    client = generateTestClient({ id: '123' });

    const values = {
      '1': equalTo(test, 1, {}),
      '42': equalTo(test, 42, {}),
    };
    client.addRule(
      newRule({
        params: {},
        valueFormat: { label: 'Some Value' },
        name: 'ruleA',
        description: '',
        granularity: RuleGranularity.CAMPAIGN,
        async callback() {
          output.push('ruleA');
          return { values };
        },
      }),
      defaultGrid,
    );
    client.addRule(
      newRule({
        params: {},
        valueFormat: { label: 'Some Value' },
        name: 'ruleB',
        description: '',
        granularity: RuleGranularity.CAMPAIGN,
        async callback() {
          output.push('ruleB');
          return { values };
        },
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

  it('should have check results after validate() is run', async () => {
    const { results } = await client.validate();
    const ruleValues: Value[] = Object.values(results['ruleA'].values);
    expect(ruleValues.map((value) => value.anomalous)).toEqual([true, false]);
  });
});

describe('RuleRange', () => {
  const rules = [
    budgetPacingPercentageRule,
    budgetPacingRuleLineItem,
    geoTargetRule,
  ];
  let client: Client;
  let ruleRange: RuleRange;

  beforeEach(() => {
    mockAppsScript();
    scaffoldSheetWithNamedRanges();
    client = generateTestClient({ id: '123' });
    rules.forEach((rule) => client.addRule(rule, [['ID'], ['default']]));
    ruleRange = new RuleRange([[]], client);
    client.getCampaignMap = async function () {
      return {
        hasAdvertiserName: true,
        campaignMap: {
          '1': { advertiserId: '1', id: '1', displayName: 'Campaign 1' },
        },
      };
    };
  });

  it('covers all granularities [sanity check]', () => {
    const ruleGranularities = new Set(
      rules.map((rule) => rule.definition.granularity),
    );
    const systemGranularities = new Set(Object.values(RuleGranularity));

    expect(ruleGranularities).toEqual(systemGranularities);
  });

  describe('getRows', () => {
    it('loads each granularity', async () => {
      let error: string;
      try {
        await ruleRange.getRows(RuleGranularity.CAMPAIGN);
      } catch (e) {
        error = String(e);
      }
      expect(error).toBeUndefined();
    });

    it('errors on unsupported granularity', async () => {
      let error: string;
      try {
        await ruleRange.getRows('Failure' as RuleGranularity);
      } catch (e) {
        error = String(e);
      }
      expect(error).toEqual('Error: Unsupported granularity "Failure"');
    });
  });

  describe('getMetadata', () => {
    it('loads each granularity', async () => {
      let error: string;
      try {
        await ruleRange.getRuleMetadata(RuleGranularity.CAMPAIGN, '1');
      } catch (e) {
        error = String(e);
      }
      expect(error).toBeUndefined();
    });

    it('errors on unsupported granularity', async () => {
      let error: string;
      try {
        await ruleRange.getRuleMetadata('Failure' as RuleGranularity, '1');
      } catch (e) {
        error = String(e);
      }
      expect(error).toEqual('Error: Unsupported granularity "Failure"');
    });
  });
});

describe('API integrations', () => {
  let client: Client;
  beforeEach(() => {
    mockAppsScript();
    const testClient = new TestClient({ id: '123' });
    UrlFetchApp.fetchAll = ((
      requests: GoogleAppsScript.URL_Fetch.URLFetchRequest[],
    ) => {
      return requests.map((_, i) => ({
        getContentText() {
          const tpl = { ...testClient.campaignTemplate };
          tpl['advertiserId'] = `a${i + 1}`;
          tpl['campaignId'] = `c${i + 1}`;
          return JSON.stringify({ campaigns: [tpl] });
        },
      }));
    }) as typeof UrlFetchApp.fetchAll;
    client = testClient.generate();
  });

  it('grabs all records from getAllCampaignsFromAdvertisers', () => {
    const campaigns = client.getAllCampaignsForAdvertisers({
      a1: 'Advertiser 1',
      a2: 'Advertiser 2',
    }) as RecordInfo[];

    expect(
      campaigns.map((c) => [c.advertiserId, c.advertiserName, c.id]),
    ).toEqual([
      ['a1', 'Advertiser 1', 'c1'],
      ['a2', 'Advertiser 2', 'c2'],
    ]);
  });
});
