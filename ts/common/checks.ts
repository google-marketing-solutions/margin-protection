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
 * @fileoverview This file contains a collection of simple, reusable validation
 * functions. These "checks" are designed to be used within rules to determine
 * if a given value is anomalous.
 */

/**
 * Checks if a numeric value falls within a specified range (inclusive).
 *
 * @param params An object containing the min and max values of the range.
 * @param value The numeric value to check.
 * @param fields A record of additional fields to include in the result.
 * @return An object containing the original value, a boolean indicating if it's
 *     anomalous, and the additional fields.
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
 * Checks if a value is equal to a specified test value.
 *
 * @param test The value to compare against.
 * @param value The value to check.
 * @param fields A record of additional fields to include in the result.
 * @return An object containing the original value, a boolean indicating if it's
 *     anomalous, and the additional fields.
 */
export function equalTo<T>(
  test: T,
  value: T,
  fields: { [fieldName: string]: string },
) {
  return { value: String(value), anomalous: value !== test, fields };
}

/**
 * Checks if a numeric value is less than or equal to a specified test value.
 *
 * @param test The value to compare against.
 * @param value The value to check.
 * @param fields A record of additional fields to include in the result.
 * @return An object containing the original value, a boolean indicating if it's
 *     anomalous, and the additional fields.
 */
export function lessThanOrEqualTo(
  test: number,
  value: number,
  fields: { [fieldName: string]: string },
) {
  return { value: String(value), anomalous: value > test, fields };
}
