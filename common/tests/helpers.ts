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
  Rule,
  RuleInstructions,
} from 'google3/third_party/professional_services/solutions/appsscript_anomaly_library/lib/main';
import {FakePropertyStore} from 'google3/third_party/professional_services/solutions/appsscript_anomaly_library/lib/testing/mock_apps_script';

import {AbstractRuleRange} from '../sheet_helpers';
import {
  BaseClientArgs,
  BaseClientInterface,
  ExecutorResult,
  ParamDefinition,
  RecordInfo,
  RuleExecutor,
  RuleExecutorClass,
} from '../types';

/**
 * Test granularity for use in tests.
 */
export enum Granularity {
  DEFAULT = 'default',
}

/**
 * Test client interface for use in tests.
 */
export interface TestClientInterface
  extends BaseClientInterface<
    TestClientInterface,
    Granularity,
    TestClientArgs
  > {
  id: string;
  getAllCampaigns(): Promise<RecordInfo[]>;
}

/**
 * Test client args for use in tests.
 */
export class TestClientArgs
  implements BaseClientArgs<TestClientInterface, Granularity, TestClientArgs> {}

/**
 * Test rule range for use in tests.
 */
export class RuleRange extends AbstractRuleRange<
  TestClientInterface,
  Granularity,
  TestClientArgs
> {
  async getRows() {
    return [{id: '1', displayName: 'Campaign 1', advertiserId: '1'}];
  }
}

/**
 * Test client for use in tests.
 */
export class Client implements TestClientInterface {
  readonly settings: TestClientArgs = {};
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<
      TestClientInterface,
      Granularity,
      TestClientArgs,
      Record<string, ParamDefinition>
    >;
  } = {};
  readonly properties = new FakePropertyStore();

  getRule(
    ruleName: string,
  ): RuleExecutor<
    TestClientInterface,
    Granularity,
    TestClientArgs,
    Record<string, ParamDefinition>
  > {
    throw new Error('Method not implemented.');
  }
  getUniqueKey(prefix: string): string {
    throw new Error('Method not implemented.');
  }
  validate(): Promise<{
    rules: Record<
      string,
      RuleExecutor<
        TestClientInterface,
        Granularity,
        TestClientArgs,
        Record<string, ParamDefinition>
      >
    >;
    results: Record<string, ExecutorResult>;
  }> {
    throw new Error('Method not implemented.');
  }
  addRule<Params extends Record<keyof Params, ParamDefinition>>(
    rule: RuleExecutorClass<
      TestClientInterface,
      Granularity,
      TestClientArgs,
      Params
    >,
    settingsArray: readonly string[][],
  ): TestClientInterface {
    throw new Error('Method not implemented.');
  }
  id = 'something';

  getAllCampaigns(): Promise<[]> {
    return Promise.resolve([]);
  }

  newRule(
    rule: (instructions: RuleInstructions) => Rule,
    instructions: Omit<RuleInstructions, 'propertyStore'>,
  ) {
    return rule({...instructions, propertyStore: this.properties});
  }
}
