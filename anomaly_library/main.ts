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
 * @fileoverview Contains the Apps Script library code for anomaly checks.
 */

import MailAdvancedParameters = GoogleAppsScript.Mail.MailAdvancedParameters;

/**
 * Retrieves `Value`s from a rule.
 */
export interface RuleGetter {
  /**
   * Retrieves values in storage.
   */
  getValues(): Value[];

  /**
   * Value objects include index specified at write-time.
   */
  getValueObject(): ValueObject;

  /**
   * Saves all values in storage, overwriting previous history.
   */
  saveValues(values: Values): void;
}

/**
 * Sets rules for values and alerts when they have been exceeded.
 *
 * A `Rule` contains a series of instructions (see `AbsoluteRule`
 * for an example) that are injected into the calling function by the client.
 *
 * It can be used to set expectations for the type of data being passed into it.
 * For example, to validate that a geo tag is set, you can create an
 * `AbsoluteRule` that checks if the result of a geo tag check is equalTo(1).
 * If it isn't, then the geo tag isn't set, and it will be marked as an anomaly.
 */
export interface Rule extends RuleGetter {
  valueIsInBounds: (value: string) => boolean;

  /**
   * Creates a value, but does not save it in storage.
   *
   * Use `saveValue` to save at the same time, or use this with
   * `getValues` and `saveValues`.
   *
   * @param value The value you want to test a rule against.
   * @param fields Space for identifiers and other supporting data for charts.
   */
  createValue(value: string, fields?: {[key: string]: string}): Value;
}

/**
 * Rule parameters to pass to a `Rule` implementation.
 */
export interface RuleInstructions {
  uniqueKey?: Readonly<string>;
  propertyStore?: PropertyStore;
}

/**
 * A rule instruction that includes a threshold value.
 */
export interface ThresholdRuleInstructions<ThresholdType> extends RuleInstructions {
  thresholdValue: Readonly<ThresholdType>;
}

/**
 * A callable type that defines a testable rule with a variable threshold.
 *
 * Example:
 *
 * > const threshold: Threshold<number> = (thresholdValue: number) => (value: string) => Number(value) * thresholdValue < 100;
 * > threshold(10)(10)
 * false
 * > threshold(5)(10)
 * true
 */
export type Threshold<ThresholdType, RuleType extends Rule = Rule> = (thresholdValue: ThresholdType, rule: RuleType) => (value: string) => boolean;

/**
 * The return value of a Rule.
 */
export interface Value<InternalType=unknown> {
  value: Readonly<string>;
  anomalous: Readonly<boolean>;
  alertedAt?: Readonly<number>;
  fields?: Readonly<{[key: string]: string}>;
  internal?: Readonly<InternalType>;
}

export interface ValueObject {
  values: Values;
  updated?: Date;
}

export interface Values {
  [key: string]: Value;
}

/**
 * Generates an email body given a list of possibly anomalous values.
 */
export function emailAlertBody(values: Value[]) {
  const anomalyList = values.filter(values => values.anomalous).map(value => {
    return `- ${value.value} for ${value.fields}`;
  });

  return `The following errors were found: \n${anomalyList.join('\n')}`;
}

/**
 * Generates an e-mail alert, then updates the alertedAt timestamp.
 *
 * Note: This comes with a default message body. If you add your own, then
 * you're responsible for including the anomaly list and avoiding duplication.
 * Because this is user-facing, tests are strongly encouraged.
 */
export function sendEmailAlert(
    rules: RuleGetter[], message: MailAdvancedParameters): void {
  const alertTime = Date.now();
  let anomalies: Value[] = [];
  for (const rule of rules) {
    const values = rule.getValueObject().values;
    anomalies = anomalies.concat(Object.values(values).filter(
        value => value.anomalous && !value.alertedAt));

    if (anomalies.length === 0) {
      return;
    }
    if (!message.body) {
      message.body = emailAlertBody(anomalies);
    }
  }

  MailApp.sendEmail(message);

  for (const anomaly of anomalies) {
    anomaly.alertedAt = alertTime;
  }
}

/**
 * Parse a JSON string version of a `Value` and return it.
 */
export function unpack(property: string|null): ValueObject {
  return (JSON.parse(property ?? '""') || {values: {}}) as ValueObject;
}

/**
 * Wrapper for `getValueByUniqueKey` that meets the `RuleGetter` interface.
 */
export function getRule(uniqueKey: string, properties: PropertyStore = new AppsScriptPropertyStore()): RuleGetter {
  return {
    getValues(): Value[] {
      return Object.values(unpack(properties.getProperty(uniqueKey)).values);
    },
    getValueObject(): ValueObject {
      return unpack(properties.getProperty(uniqueKey));
    },
    saveValues(values: Values) {
      const nonAnomalousValues =
          Object.entries(values).reduce((obj, [k, v]) => {
            if (v.anomalous) {
              obj[k] = v;
            }
            return obj;
          }, {} as Values);
      properties.setProperty(
          uniqueKey,
          JSON.stringify({values: nonAnomalousValues, updated: new Date()}));
    }
  };
}

/**
 * Provides convenience methods to manage property getters and setters.
 *
 * This class uses `gzip` to stay within storage quotas for PropertiesService.
 */
export class AppsScriptPropertyStore implements PropertyStore {
  private static readonly cache: {[key: string]: string} = {};

  constructor(
      private readonly properties = PropertiesService.getScriptProperties(),
  ) {
  }

  setProperty(key: string, value: string) {
    this.properties.setProperty(key, compress(value));
    AppsScriptPropertyStore.cache[key] = value;
  }

  getProperty(key: string) {
    if (AppsScriptPropertyStore.cache[key]) {
      return AppsScriptPropertyStore.cache[key];
    }
    const property = this.properties.getProperty(key);
    return property ? extract(property) : null;
  }

  getProperties() {
    return Object.fromEntries(
        Object.entries(this.properties.getProperties()).map(([k, v]) =>
       [k, extract(v)]
    ));
  }
}

/**
 * Compresses a blob and condenses it to a base64 string.
 */
function compress(content: string): string {
  const blob = Utilities.newBlob(content);
  const zip = Utilities.gzip(blob);
  return Utilities.base64Encode(zip.getBytes());
}

/**
 * The opposite of {@link compress}.
 */
function extract(content: string): string {
  try {
    const decode = Utilities.base64Decode(content);
    const blob = Utilities.newBlob(decode, 'application/x-gzip');
    return Utilities.ungzip(blob).getDataAsString();
  } catch (e) {
    return content; // already extracted
  }
}

/**
 * An abstraction for retrieving properties.
 */
export interface PropertyStore {
  setProperty(propertyName: string, value: string): void;
  getProperty(propertyName: string): string | null;
  getProperties(): Record<string, string>;
}