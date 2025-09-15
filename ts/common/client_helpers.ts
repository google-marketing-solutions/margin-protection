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
 * @fileoverview This file provides frontend-agnostic helpers for the client,
 * primarily focusing on a factory for creating rule execution classes.
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
 * A higher-order function that returns a factory for creating rule classes.
 * This pattern allows for the creation of type-safe, client-specific rule
 * builders.
 *
 * @return A `newRule` function that can be used to define and construct rule
 *     executor classes.
 */
export function newRuleBuilder<T extends ClientTypes<T>>(): <
  P extends Record<keyof P, ParamDefinition>,
>(
  p: RuleParams<T, P> & ThisType<RuleExecutor<T, P>>,
) => RuleExecutorClass<T, P> {
  /**
   * Defines a new rule and returns a class constructor for it.
   * The returned class implements the `RuleExecutor` interface and encapsulates
   * the logic and properties of the rule.
   *
   * @param ruleDefinition An object containing the rule's parameters,
   *     metadata, and execution callback. The `callback` function will have its
   *     `this` context set to the instance of the rule executor class,
   *     providing access to settings and other instance properties.
   * @return A class that can be instantiated to execute the rule.
   */
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
