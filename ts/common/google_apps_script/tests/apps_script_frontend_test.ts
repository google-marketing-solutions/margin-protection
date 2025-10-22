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

import { beforeEach, describe, expect, it } from 'vitest';
import {
  FakePropertyStore,
  mockAppsScript,
} from '../../test_helpers/mock_apps_script.js';
import {
  FakeClient,
  FakeFrontend,
  Granularity,
  newRule,
  RuleRange,
} from '../../tests/helpers.js';
import { SettingMap } from '#common/sheet_helpers/setting_map.js';

describe('AppsScriptFrontend', function () {
  let frontend: FakeFrontend;
  let properties: FakePropertyStore;

  beforeEach(function () {
    mockAppsScript();
    FakePropertyStore.clearCache();
    properties = new FakePropertyStore();
  });

  describe('saveSettingsBackToSheets', function () {
    it('saves settings correctly to properties', function () {
      const ruleDef = {
        name: 'Test Rule',
        description: 'Test Description',
        granularity: Granularity.DEFAULT,
        params: {
          testParam: { label: 'Test Param', name: 'testParam' },
        },
        valueFormat: {
          label: 'Value',
        },
        async callback() {
          return { values: {} };
        },
      };
      const rule = newRule(ruleDef);

      const sheetValues = [
        [], // row 0
        [], // row 1
        ['ID', 'Name', 'Test Param'], // row 2 - headers
        ['default', '', 'defaultValue'], // row 3
        ['id1', 'name1', 'value1'], // row 4
      ];

      const sheetName = `Rule Settings - ${Granularity.DEFAULT}`;
      const nonEmptyRows = sheetValues.filter((row) => row.length > 0);
      SpreadsheetApp.getActive()
        .insertSheet(sheetName)
        .getRange(1, 1, nonEmptyRows.length, nonEmptyRows[0].length)
        .setValues(nonEmptyRows);

      frontend = new FakeFrontend({
        ruleRangeClass: RuleRange,
        rules: [rule],
        version: '1.0',
        clientInitializer: () => new FakeClient('test', properties),
        migrations: [],
        properties,
      });

      const client = new FakeClient('test', properties);
      const ruleInstance = new rule(client, sheetValues);
      ruleInstance.settings = new SettingMap([
        ['default', { testParam: 'defaultValue' }],
        ['id1', { testParam: 'value1' }],
      ]);

      (
        frontend as unknown as {
          saveSettingsBackToSheets: FakeFrontend['saveSettingsBackToSheets'];
        }
      ).saveSettingsBackToSheets([ruleInstance]);

      const json = properties.getProperty('Test Rule') || '{}';
      const parsed = JSON.parse(json);
      const savedSettings = new SettingMap(
        Object.entries(parsed) as [string, { testParam: string }][],
      );
      console.log(savedSettings);

      expect(savedSettings.get('id1')).toEqual({
        testParam: 'value1',
      });
      expect(savedSettings.getOrDefault('id2')).toEqual({
        testParam: 'defaultValue',
      });
    });
  });
});
