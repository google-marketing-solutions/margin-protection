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
  Rule,
  RuleInstructions,
} from 'anomaly_library/main';
import {FakePropertyStore} from 'anomaly_library/testing/mock_apps_script';

import {AbstractRuleRange} from '../sheet_helpers';
import {
  BaseClientArgs,
  BaseClientInterface,
  ParamDefinition,
  RecordInfo,
  RuleExecutor,
  RuleExecutorClass,
} from '../types';

export enum Granularity {
  DEFAULT = 'default',
}

export interface TestClientInterface
  extends BaseClientInterface<
    TestClientInterface,
    Granularity,
    TestClientArgs
  > {
  id: string;
  getAllCampaigns(): Promise<RecordInfo[]>;
}
export class TestClientArgs
  implements BaseClientArgs<TestClientInterface, Granularity, TestClientArgs> {}

export class RuleRange extends AbstractRuleRange<
  TestClientInterface,
  Granularity,
  TestClientArgs
> {
  async getRows() {
    return [{id: '1', displayName: 'Campaign 1', advertiserId: '1'}];
  }
}

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
  validate(): Promise<
    Array<
      RuleExecutor<
        TestClientInterface,
        Granularity,
        TestClientArgs,
        Record<string, ParamDefinition>
      >
    >
  > {
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
  id: string = 'something';

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
