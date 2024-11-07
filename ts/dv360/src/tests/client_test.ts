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

import { equalTo } from 'common/checks';
import {
  generateFakeHttpResponse,
  mockAppsScript,
} from 'common/test_helpers/mock_apps_script';
import { Value } from 'common/types';

import { Client, newRule, RuleRange } from '../client';
import { RuleGranularity } from '../types';

import { generateTestClient } from './client_helpers';
import { expect } from 'chai';
import {
  budgetPacingPercentageRule,
  budgetPacingRuleLineItem,
  geoTargetRule,
} from '../rules';
import { scaffoldSheetWithNamedRanges } from 'common/tests/helpers';

describe('Client rules are validated', function () {
  let output: string[] = [];
  const test = 42;
  let client: Client;
  const defaultGrid = [
    ['', 'param1', 'param2'],
    ['default', '1', '2'],
  ];

  beforeEach(function () {
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

  afterEach(function () {
    output = [];
  });

  it('should not run rules until validate() is run', function () {
    expect(output).to.eql([]);
  });

  it('should run rules when validate() is run', async function () {
    await client.validate();
    expect(output).to.eql(['ruleA', 'ruleB']);
  });

  it('should have check results after validate() is run', async function () {
    const { results } = await client.validate();
    const ruleValues: Value[] = Object.values(results['ruleA'].values);
    expect(ruleValues.map((value) => value.anomalous)).to.eql([true, false]);
  });
});

describe('RuleRange', function () {
  const rules = [
    budgetPacingPercentageRule,
    budgetPacingRuleLineItem,
    geoTargetRule,
  ];

  beforeEach(function () {
    scaffoldSheetWithNamedRanges();
    this.client = generateTestClient({ id: '123' });
    rules.forEach((rule) => this.client.addRule(rule, [['ID'], ['default']]));
    this.ruleRange = new RuleRange([[]], this.client);
    this.ruleRange.getCampaignMap = function () {
      return { hasAdvertiserName: true, campaignMap: { '1': {} } };
    };
  });

  it('covers all granularities [sanity check]', function () {
    const ruleGranularities = new Set(
      rules.map((rule) => rule.definition.granularity),
    );
    const systemGranularities = new Set(Object.values(RuleGranularity));

    expect(ruleGranularities).to.eql(systemGranularities);
  });

  context('getRows', function () {
    it('loads each granularity', async function () {
      let error: string;
      try {
        await this.ruleRange.getRows(RuleGranularity.CAMPAIGN);
      } catch (e) {
        error = String(e);
      }
      expect(error).to.be.undefined;
    });

    it('errors on unsupported granularity', async function () {
      let error: string;
      try {
        await this.ruleRange.getRows('Failure', '1');
      } catch (e) {
        error = String(e);
      }
      expect(error).to.equal('Error: Unsupported granularity "Failure"');
    });
  });

  context('getMetadata', function () {
    it('loads each granularity', async function () {
      let error: string;
      try {
        await this.ruleRange.getRuleMetadata(RuleGranularity.CAMPAIGN, '1');
      } catch (e) {
        error = String(e);
      }
      expect(error).to.be.undefined;
    });

    it('errors on unsupported granularity', async function () {
      let error: string;
      try {
        await this.ruleRange.getRuleMetadata('Failure', '1');
      } catch (e) {
        error = String(e);
      }
      expect(error).to.equal('Error: Unsupported granularity "Failure"');
    });
  });
});
