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

import 'mocha';
import { expect } from 'chai';
import { SettingMap, transformToParamValues } from '../setting_map';
import { mockAppsScript } from '../../test_helpers/mock_apps_script';

describe('SettingMap', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  describe('transformToParamValues', function () {
    let array2d: string[][];
    const params = { rule1: { label: 'Rule 1' }, rule2: { label: 'Rule 2' } };

    beforeEach(function () {
      array2d = [
        ['', 'Rule 1', 'Rule 2'],
        ['1', 'A', 'B'],
        ['2', 'C', 'D'],
      ];
    });

    it('transforms into a param', function () {
      expect(transformToParamValues(array2d, params)).to.deep.eq(
        new SettingMap([
          ['1', { rule1: 'A', rule2: 'B' }],
          ['2', { rule1: 'C', rule2: 'D' }],
        ]),
      );
    });

    it('triggers an error if empty', function () {
      const error = new Error(
        'Expected a grid with row and column headers of at least size 2',
      );
      expect(() => transformToParamValues([], params)).to.throw(error.message);
      expect(() => transformToParamValues([[]], params)).to.throw(
        error.message,
      );
      expect(() => transformToParamValues([['']], params)).to.throw(
        error.message,
      );
    });
  });

  describe('#getOrDefault', function () {
    it('returns value', function () {
      const settingMap = new SettingMap([
        ['default', { rule1: 'A' }],
        ['1', { rule1: 'C' }],
      ]);
      expect(settingMap.getOrDefault('1').rule1).to.equal('C');
    });

    it('returns defaults when value is blank', function () {
      const settingMap = new SettingMap([
        ['default', { rule1: 'A' }],
        ['1', { rule1: '' }],
      ]);
      expect(settingMap.getOrDefault('1').rule1).to.equal('A');
    });

    it('returns value when value is 0', function () {
      const settingMap = new SettingMap([
        ['default', { rule1: 'A' }],
        ['1', { rule1: '0' }],
      ]);
      expect(settingMap.getOrDefault('1').rule1).to.equal('0');
    });

    it('returns blank when default is undefined and value is blank', function () {
      const settingMap = new SettingMap([['1', { rule1: '' }]]);
      expect(settingMap.getOrDefault('1').rule1).to.equal('');
    });
  });
});
