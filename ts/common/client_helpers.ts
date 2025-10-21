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
  ClientTypes,
  ParamDefinition,
  RuleExecutor,
  RuleExecutorClass,
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
export function newRuleBuilder<T extends ClientTypes<T>>(): <
  P extends Record<keyof P, ParamDefinition>,
>(
  p: RuleParams<T, P> & ThisType<RuleExecutor<T, P>>,
) => RuleExecutorClass<T, P> {
  return function newRule<P extends Record<keyof P, ParamDefinition>>(
    ruleDefinition: RuleParams<T, P>,
  ): RuleExecutorClass<T, P> {
    const ruleClass = class implements RuleExecutor<T, P> {
      readonly settings: Settings<Record<keyof P, string>>;
      readonly name: string = ruleDefinition.name;
      readonly description: string = ruleDefinition.description;
      readonly params = ruleDefinition.params;
      readonly helper = ruleDefinition.helper ?? '';
      readonly granularity: T['ruleGranularity'] = ruleDefinition.granularity;
      readonly valueFormat = ruleDefinition.valueFormat;
      readonly enabled = true;
      static definition = ruleDefinition;

      constructor(
        readonly client: T['client'],
        settingsArray: ReadonlyArray<string[]>,
      ) {
        this.settings = transformToParamValues(
          settingsArray,
          ruleDefinition.params,
        );
      }

      getParams() {
        return ruleDefinition.params;
      }

      getRuleName() {
        return ruleDefinition.name;
      }

      getGranularity() {
        return ruleDefinition.granularity;
      }

      async run() {
        return await ruleDefinition.callback.bind(this)();
      }
    };

    Object.defineProperty(ruleClass, 'name', { value: ruleDefinition.name });
    return ruleClass;
  };
}
