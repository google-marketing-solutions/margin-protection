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
 * @fileoverview Client helpers - frontend agnostic.
 */

import { transformToParamValues } from './sheet_helpers';
import {
  BaseClientArgs,
  BaseClientInterface,
  ParamDefinition,
  RuleExecutor,
  RuleExecutorClass,
  RuleGranularity,
  RuleParams,
  Settings,
} from './types';

/**
 * Creates new rule with the metadata needed to generate settings.
 *
 * Wrapping in this function gives us access to all methods in {@link
 * RuleUtilities} as part of `this` in our `callback`.
 *
 * Example:
 *
 * ```
 * newRule({
 *   //...
 *   callback(client, settings) {
 *     const rule = this.getRule(); // the `RuleGetter`
 *     const rule = rule.getValues();
 *     //...
 *   }
 * });
 * ```
 */

// This returns a function that is self-typed.
// tslint:disable-next-line:no-return-only-generics
export function newRuleBuilder<
  C extends BaseClientInterface<C, G, A>,
  G extends RuleGranularity<G>,
  A extends BaseClientArgs,
>(): <P extends Record<keyof P, ParamDefinition>>(
  p: RuleParams<C, G, A, P> & ThisType<RuleExecutor<C, G, A, P>>,
) => RuleExecutorClass<C, G, A, P> {
  return function newRule<P extends Record<keyof P, ParamDefinition>>(
    ruleDefinition: RuleParams<C, G, A, P>,
  ): RuleExecutorClass<C, G, A, P> {
    const ruleClass = class implements RuleExecutor<C, G, A, P> {
      readonly settings: Settings<Record<keyof P, string>>;
      readonly name: string = ruleDefinition.name;
      readonly description: string = ruleDefinition.description;
      readonly params = ruleDefinition.params;
      readonly helper = ruleDefinition.helper ?? '';
      readonly granularity: G = ruleDefinition.granularity;
      readonly valueFormat = ruleDefinition.valueFormat;
      static definition = ruleDefinition;

      constructor(
        readonly client: C,
        settingsArray: ReadonlyArray<string[]>,
      ) {
        this.settings = transformToParamValues(settingsArray, this.params);
      }

      async run() {
        return await ruleDefinition.callback.bind(this)();
      }
    };

    Object.defineProperty(ruleClass, 'name', { value: ruleDefinition.name });
    return ruleClass;
  };
}
