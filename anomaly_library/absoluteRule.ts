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
 * @fileoverview Contains functions for absolute error values. The exported
 * functions trigger alerts when their condition is satisfied.
 */


import {PropertyStore, Rule, Threshold, ThresholdRuleInstructions, Value, ValueObject, Values} from 'anomaly_library/main';

/**
 * Checks for any anomalies based on a fixed `Threshold`.
 *
 * Rules can be generated dynamically, requiring a `ThresholdType`
 * to implement. Examples are below (see `equalTo`, and `inRange`).
 */
export class AbsoluteRule<ThresholdType> implements Rule {
  private readonly uniqueKey?: string;
  readonly valueIsInBounds: (value: string) => boolean;
  private readonly properties?: PropertyStore;

  /**
   * Object constructor
   */
  constructor(
      instructions: ThresholdRuleInstructions<ThresholdType>,
      threshold: Threshold<ThresholdType, AbsoluteRule<ThresholdType>>,
  ) {
    this.uniqueKey = instructions.uniqueKey;
    this.properties = instructions.propertyStore;
    // default is arbitrary - assuming hourly checks this is 4 days of data.
    this.valueIsInBounds = threshold(instructions.thresholdValue, this);
  }

  createValue(v: string|number, fields?: {[fieldName: string]: string}): Value {
    const value = v.toString();
    return {
      value,
      anomalous: !this.valueIsInBounds(value),
      fields,
    };
  }

  /**
   * Saves values iff they are anomalous.
   */
  saveValues(values: Values) {
    if (!this.uniqueKey) {
      throw new Error('uniqueKey is required for saving');
    }
    if (!this.properties) {
      throw new Error('properties is required for saving');
    }

    const nonAnomalousValues = Object.entries(values).reduce((obj, [k, v]) => {
      if (v.anomalous) {
        obj[k] = v;
      }
      return obj;
    }, {} as Values);
    this.properties.setProperty(
        this.uniqueKey, JSON.stringify({ values: nonAnomalousValues }));
  }

  getValues(): Value[] {
    return Object.values(this.getValueObject().values);
  }

  getValueObject() {
    if (!this.uniqueKey) {
      throw new Error('uniqueKey is required for value retrieval');
    }

    if (!this.properties) {
      throw new Error('properties is required for value retrieval');
    }

    return (JSON.parse(this.properties.getProperty(this.uniqueKey) ?? '""') ||
        {values: {}}) as ValueObject;
  }
}

/**
 * Triggers an alert when a value equals `RuleInstructions#thresholdValue`
 *
 * @example
 * // If you want to alert whenever a value equals zero
 * equalTo({uniqueKey: 'notZero'})
 */
export function equalTo(instructions: ThresholdRuleInstructions<number>) {
  return new AbsoluteRule(instructions, (thresholdValue) => (value) => Number(value) === thresholdValue);
}

/**
 * Ensures a value doesn't equal `RuleInstructions#thresholdValue`
 *
 * @example
 * notEqualTo({thresholdValue: 0, uniqueKey: 'zero'})
 */
export function notEqualTo(instructions: ThresholdRuleInstructions<number>) {
  return new AbsoluteRule(instructions, (thresholdValue) => (value) => Number(value) !== thresholdValue);
}

/**
 * Ensures a value is >= `RuleInstructions#thresholdValue`
 *
 * @example
 * greaterThanOrEqualTo({thresholdValue: 0, uniqueKey: 'positiveOrZero'})
 */
export function greaterThanOrEqualTo(instructions: ThresholdRuleInstructions<number>) {
  return new AbsoluteRule(instructions, thresholdValue => value => Number(value) >= thresholdValue);
}

/**
 * Ensures a value is > `RuleInstructions#thresholdValue`
 *
 * @example
 * greaterThan({thresholdValue: 0, uniqueKey: 'positive'})
 */
export function greaterThan(instructions: ThresholdRuleInstructions<number>) {
  return new AbsoluteRule(instructions, thresholdValue => value => Number(value) > thresholdValue);
}

/**
 * Ensures a value is <= `RuleInstructions#thresholdValue`
 *
 * @example
 * lessThanOrEqualTo({thresholdValue: 0, uniqueKey: 'negativeOrZero'})
 */
export function lessThanOrEqualTo(instructions: ThresholdRuleInstructions<number>) {
  return new AbsoluteRule(instructions, thresholdValue => value => Number(value) <= thresholdValue);
}

/**
 * Ensures a value is < `RuleInstructions#thresholdValue`
 *
 * @example
 * lessThan({thresholdValue: 0, uniqueKey: 'negative'})
 */
export function lessThan(instructions: ThresholdRuleInstructions<number>) {
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
export function inRange(instructions: ThresholdRuleInstructions<ThresholdRange>) {
  return new AbsoluteRule(instructions, thresholdValue => value => Number(value) >= thresholdValue.min && Number(value) <= thresholdValue.max);
}
