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
 * @fileoverview A series of checks that can be used for a rule.
 */

/**
 * Ensures that a value is in a range between min and max (inclusive).
 */
export function inRange(
  { min, max }: { min: number; max: number },
  value: number,
  fields: { [fieldName: string]: string },
) {
  return {
    value: String(value),
    anomalous: !(value >= min && value <= max),
    fields,
  };
}

/**
 * Ensures a value is equal to a test value.
 */
export function equalTo<T>(
  test: T,
  value: T,
  fields: { [fieldName: string]: string },
) {
  return { value: String(value), anomalous: value !== test, fields };
}

/**
 * Ensures a value is less than or equal to a test value.
 */
export function lessThanOrEqualTo(
  test: number,
  value: number,
  fields: { [fieldName: string]: string },
) {
  return { value: String(value), anomalous: value > test, fields };
}
