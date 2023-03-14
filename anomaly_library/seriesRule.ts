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

import {Rule, RuleInstructions, Threshold, unpack, Value} from './main';

/**
 * Checks for any anomalies based on a series of values.
 *
 * Rules can be generated dynamically, requiring a `ThresholdType`
 * to implement. Examples are below (see `equalTo`, and `inRange`).
 *
 * The series is time agnostic, so it's important that the time cadence
 * is defined by the creator of the rule. For this reason, only one agent should
 * ever write to this rule at one time.
 *
 * An example of a use case for this is checking history. If a flag was "1"
 * in the past, it's been 0 since, and there should be an alert if it flips back
 * to "1", then this would return an anomalous report.
 */
export class SeriesRule<ThresholdType> implements Rule {
  private readonly uniqueKey: string;
  private readonly properties: GoogleAppsScript.Properties.Properties;
  readonly valueIsInBounds: (value: string) => boolean;

  /**
   * Object constructor
   */
  constructor(
      instructions: RuleInstructions<ThresholdType>,
      threshold: Threshold<ThresholdType>,
  ) {
    this.uniqueKey = instructions.uniqueKey;
    this.properties = PropertiesService.getScriptProperties();
    this.valueIsInBounds = threshold(instructions.thresholdValue);
  }

  saveValues(values: Array<Value>) {
    this.properties.setProperty(
        this.uniqueKey, JSON.stringify(values));
  }

  getValues(): Array<Value> {
    return unpack(
        this.properties.getProperty(this.uniqueKey));
  }

  createValue(value: string, fields?: {[key: string]: string}): Value {
    return {
      value,
      anomalous: !this.valueIsInBounds(value),
      fields,
    };
  }
}

/**
 * Given a series, this rule is anomalous when 1, 0XN, 1 is true.
 *
 * If 1 is never seen, if 1 is the only thing seen, or if 1 is only >N times,
 * then this is not an error.
 */
export function neverTrueAfterNFalse(instructions: RuleInstructions<number>) {
  return new SeriesRule(instructions, (thresholdValue) => (value) => {
    const valuesList = JSON.parse(value) as number[];
    let maxConsecutiveFalse = 0;
    let maxConsecutiveFalseAfterTrue = 0;
    let consecutiveFalse = -1;
    for (let i = 0; i < valuesList.length; i++) {
      const v = valuesList[i];
      if (v === 1) {
        consecutiveFalse = 0;
        maxConsecutiveFalseAfterTrue = maxConsecutiveFalse;
      } else if (v === 0) {
        if (consecutiveFalse < 0) {
          continue;
        }
        maxConsecutiveFalse = Math.max(++consecutiveFalse, maxConsecutiveFalse);
      }
    }
    return maxConsecutiveFalseAfterTrue <= thresholdValue;
  });
}