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
 * Given two string semver values, checks to see which one is larger.
 *
 * Given '1.2.1' and '1.1.0', the result will be 0.1.1, which would sort the
 * second value as higher than the first value.
 *
 * @param ver1 A semver value
 * @param ver2 A semver value
 */
export function sortMigrations(ver1: string, ver2: string): number {
  if (ver1.includes('.') && ver2.includes('.')) {
    const keys1 = ver1.split('.').map(Number);
    const keys2 = ver2.split('.').map(Number);
    let difference = 0;
    for (let i = 0; i < Math.max(keys1.length, keys2.length); i++) {
      difference += ((keys1[i] ?? 0) - (keys2[i] ?? 0)) / 10 ** i;
    }
    return difference;
  }
  return ver1.localeCompare(ver2);
}
