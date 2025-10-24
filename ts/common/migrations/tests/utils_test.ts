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

import { sortMigrations } from '../utils.js';
import { describe, expect, it } from 'vitest';

describe('sortMigrations', function () {
  it('sorts migrations as expected', function () {
    expect(['0.6', '1.2', '1.0'].sort(sortMigrations)).toEqual([
      '0.6',
      '1.0',
      '1.2',
    ]);
  });

  it('manages incremental versions', function () {
    expect(['0.6.1', '0.6', '1.0'].sort(sortMigrations)).toEqual([
      '0.6',
      '0.6.1',
      '1.0',
    ]);
  });

  it('works with objects', function () {
    expect(
      Object.entries({ '0.1': 'b', '0.0.1': 'a' }).sort((e1, e2) =>
        sortMigrations(e1[0], e2[0]),
      ),
    ).toEqual([
      ['0.0.1', 'a'],
      ['0.1', 'b'],
    ]);
  });
});
