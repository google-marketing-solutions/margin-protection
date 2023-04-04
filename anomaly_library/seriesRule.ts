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

import {PropertyWrapper, Rule, RuleInstructions, Value, Values} from './main';

type RuleInjector = (rule: LockedSeriesRule) => (value: string) => boolean;

/**
 * Checks for any anomalies based on whether a setting has changed.
 *
 * This "locks" a setting in place the first time it's set. Any subsequent
 * write will compare keys to see if changes have been made. Any changes will
 * result in an anomalous recording.
 */
export class LockedSeriesRule implements Rule {
  private readonly uniqueKey: string;
  private readonly properties = new PropertyWrapper();
  readonly valueIsInBounds: (value: string) => boolean;
  private storedValue: Values | undefined;
  static NO_CHANGES = 'No Changes';

  /**
   * Object constructor
   *
   * @param instructions
   * @param threshold
   * @param message A callable to return a human-readable message explaining
   *   the reason for an error or lack therein.
   */
  constructor(
      instructions: RuleInstructions,
      threshold: RuleInjector,
  ) {
    this.uniqueKey = instructions.uniqueKey;
    this.valueIsInBounds = threshold(this);
  }

  saveValues(values: Values) {
    this.properties.setProperty(this.uniqueKey, JSON.stringify(values));
    this.storedValue = values;
  }

  getValueObject() {
    if (!this.storedValue) {
      this.storedValue = JSON.parse(this.properties.getProperty(this.uniqueKey) ?? '{}') as Values;
    }

    return this.storedValue;
  }

  getValues(): Value[] {
    return Object.values(this.getValueObject());
  }

  /**
   * Convenience method creates human-readable messages.
   *
   * Tracks any changes and, if none, sets "No Changes" as the value.
   *
   * @param id The same ID that's passed in as the object value for {@link Values}.
   * @param values A key/value pair object with the unique key as key.
   * @param fields Extra metadata that's used in reporting.
   */
  createValueMessage(id: string, values: {[key: string]: string}, fields?: {[key: string]: string}): Value {
    const originalRaw = this.getValueObject()[id]?.internal as {original: {[key: string]: string}} | undefined;
    const original = originalRaw?.original ?? values;
    const newValues = [];

    for (const key of Object.keys(values)) {
      if (!original[key] || original[key] === values[key]) {
        continue;
      }
      newValues.push(`${key}: ${original[key]} -> ${values[key]}`);
    }
    return this.createValue(newValues.join(', ') || LockedSeriesRule.NO_CHANGES, fields, {original});
  }

  createValue<I>(value: string, fields?: {[key: string]: string}, internal?: I): Value<I> {
    return {
      value,
      anomalous: !this.valueIsInBounds(value),
      fields,
      internal,
    };
  }
}

/**
 * Tracks and alerts on status changes.
 */
export function neverChangeAfterSet(instructions: RuleInstructions) {
  return new LockedSeriesRule(instructions, (rule) => (value) => value === LockedSeriesRule.NO_CHANGES);
}
