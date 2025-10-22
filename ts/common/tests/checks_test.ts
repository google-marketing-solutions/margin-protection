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

import { describe, expect, it } from 'vitest';
import { equalTo, inRange, lessThanOrEqualTo } from '../checks.js';

describe('check range logic', function () {
  const test = { min: 1, max: 5 };
  for (const i of [1, 2, 3, 4, 5]) {
    it(`${i} in range of ${test.min} and ${test.max}`, function () {
      expect(inRange(test, i, {}).anomalous).to.be.false;
    });
  }

  for (const i of [0, 6]) {
    it(`${i} outside of range ${test.min} and ${test.max}`, function () {
      [0, 6].forEach((i) => expect(inRange(test, i, {}).anomalous).to.be.true);
    });
  }
});

describe('equalTo', function () {
  const test = 2;

  it('happy path', function () {
    expect(equalTo(test, 2, {}).anomalous).to.be.false;
  });

  it('sad path', function () {
    [1, '2', 2.1, 3].forEach(
      (i) => expect(equalTo(test, i, {}).anomalous).to.be.true,
    );
  });
});

describe('lessThanOrEqualTo', function () {
  const test = 2;

  it('happy path', function () {
    [0, 1, 1.9, 2].forEach(
      (i) => expect(lessThanOrEqualTo(test, i, {}).anomalous).to.be.false,
    );
  });

  it('sad path', function () {
    [2.1, 3].forEach(
      (i) => expect(lessThanOrEqualTo(test, i, {}).anomalous).to.be.true,
    );
  });
});
