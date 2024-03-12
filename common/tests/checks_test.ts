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

import {equalTo, inRange, lessThanOrEqualTo} from '../checks';

describe('checks test', () => {
  describe('inRange', () => {
    const test = {min: 1, max: 5};
    it('handles values in range', () => {
      [1, 2, 3, 4, 5].forEach((i) =>
        expect(inRange(test, i, {}).anomalous).toBeFalse(),
      );
    });

    it('erorrs on handles out of range', () => {
      [0, 6].forEach((i) => expect(inRange(test, i, {}).anomalous).toBeTrue());
    });
  });

  describe('equalTo', () => {
    const test = 2;
    it('happy path', () => {
      expect(equalTo(test, 2, {}).anomalous).toBeFalse();
    });

    it('sad path', () => {
      [1, '2', 2.1, 3].forEach((i) =>
        expect(equalTo(test, i, {}).anomalous).toBeTrue(),
      );
    });
  });

  describe('lessThanOrEqualTo', () => {
    const test = 2;
    it('happy path', () => {
      [0, 1, 1.9, 2].forEach((i) =>
        expect(lessThanOrEqualTo(test, i, {}).anomalous).toBeFalse(),
      );
    });

    it('sad path', () => {
      [2.1, 3].forEach((i) =>
        expect(lessThanOrEqualTo(test, i, {}).anomalous).toBeTrue(),
      );
    });
  });
});
