/**
 * @license
 * Copyright 2024 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may- obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { PropertyStore } from 'common/types';

/**
 * Provides convenience methods to manage property getters and setters.
 *
 * This class uses `gzip` to stay within storage quotas for PropertiesService.
 */
export class AppsScriptPropertyStore implements PropertyStore {
  private static readonly cache: { [key: string]: string } = {};

  constructor(
    private readonly properties = PropertiesService.getScriptProperties(),
  ) {}

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
      Object.entries(this.properties.getProperties()).map(([k, v]) => [
        k,
        extract(v),
      ]),
    );
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
  } catch {
    return content; // already extracted
  }
}
