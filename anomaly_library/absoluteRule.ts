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

/**
 * @fileoverview Contains functions for absolute error values. The exported
 * functions trigger alerts when their condition is satisfied.
 */


import {PropertyWrapper, Rule, RuleInstructions, Threshold, unpack, Value} from 'anomaly_library/main';

/**
 * Checks for any anomalies based on a fixed `Threshold`.
 *
 * Rules can be generated dynamically, requiring a `ThresholdType`
 * to implement. Examples are below (see `equalTo`, and `inRange`).
 */
export class AbsoluteRule<ThresholdType> implements Rule {
  private readonly uniqueKey: string;
  private readonly properties = new PropertyWrapper();
  readonly valueIsInBounds: (value: string) => boolean;

  /**
   * Object constructor
   */
  constructor(
      instructions: RuleInstructions<ThresholdType>,
      threshold: Threshold<ThresholdType>,
  ) {
    this.uniqueKey = instructions.uniqueKey;
    // default is arbitrary - assuming hourly checks this is 4 days of data.
    this.valueIsInBounds = threshold(instructions.thresholdValue);
  }

  createValue(v: string|number, fields?: {[fieldName: string]: string}): Value {
    const value = v.toString();
    return {
      value,
      anomalous: !this.valueIsInBounds(value),
      fields,
    };
  }

  saveValues(values: Value[]) {
    this.properties.setProperty(
        this.uniqueKey, JSON.stringify(values));
  }

  getValues(): Value[] {
    return unpack(
        this.properties.getProperty(this.uniqueKey));
  }
}

/**
 * Triggers an alert when a value equals `RuleInstructions#thresholdValue`
 *
 * @example
 * // If you want to alert whenever a value equals zero
 * equalTo({uniqueKey: 'notZero'})
 */
export function equalTo(instructions: RuleInstructions<number>) {
  return new AbsoluteRule(instructions, (thresholdValue) => (value) => Number(value) === thresholdValue);
}

/**
 * Ensures a value doesn't equal `RuleInstructions#thresholdValue`
 *
 * @example
 * notEqualTo({thresholdValue: 0, uniqueKey: 'zero'})
 */
export function notEqualTo(instructions: RuleInstructions<number>) {
  return new AbsoluteRule(instructions, (thresholdValue) => (value) => Number(value) !== thresholdValue);
}

/**
 * Ensures a value is >= `RuleInstructions#thresholdValue`
 *
 * @example
 * greaterThanOrEqualTo({thresholdValue: 0, uniqueKey: 'positiveOrZero'})
 */
export function greaterThanOrEqualTo(instructions: RuleInstructions<number>) {
  return new AbsoluteRule(instructions, thresholdValue => value => Number(value) >= thresholdValue);
}

/**
 * Ensures a value is > `RuleInstructions#thresholdValue`
 *
 * @example
 * greaterThan({thresholdValue: 0, uniqueKey: 'positive'})
 */
export function greaterThan(instructions: RuleInstructions<number>) {
  return new AbsoluteRule(instructions, thresholdValue => value => Number(value) > thresholdValue);
}

/**
 * Ensures a value is <= `RuleInstructions#thresholdValue`
 *
 * @example
 * lessThanOrEqualTo({thresholdValue: 0, uniqueKey: 'negativeOrZero'})
 */
export function lessThanOrEqualTo(instructions: RuleInstructions<number>) {
  return new AbsoluteRule(instructions, thresholdValue => value => Number(value) <= thresholdValue);
}

/**
 * Ensures a value is < `RuleInstructions#thresholdValue`
 *
 * @example
 * lessThan({thresholdValue: 0, uniqueKey: 'negative'})
 */
export function lessThan(instructions: RuleInstructions<number>) {
  return new AbsoluteRule(instructions, thresholdValue => value => Number(value) < thresholdValue);
}

/**
 * Defines a range from `min` to `max`.
 */
export interface ThresholdRange {
  min: Readonly<number>;
  max: Readonly<number>;
}

/**
 * Ensures a value is in a range between `RuleInstructions#thresholdValue.min` and `RuleInstructions#thresholdValue.max`
 * @param instructions
 */
export function inRange(instructions: RuleInstructions<ThresholdRange>) {
  return new AbsoluteRule(instructions, thresholdValue => value => Number(value) >= thresholdValue.min && Number(value) <= thresholdValue.max);
}