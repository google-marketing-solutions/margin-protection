/**
 * @license
 * Copyright 2025 Google LLC.
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

import {
  FakePropertyStore,
  mockAppsScript,
} from '../../test_helpers/mock_apps_script.js';
import { FakeClient, FakeFrontend, RuleRange } from '../../tests/helpers.js';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { scaffoldSheetWithNamedRanges } from '../../tests/helpers.js';

describe('AppsScriptFrontend.getSettings', () => {
  let frontend: FakeFrontend;

  beforeEach(() => {
    mockAppsScript();
    scaffoldSheetWithNamedRanges({
      namedRanges: [
        ['ID_TYPE', 'Campaign'],
        ['OTHER_SETTING', 'Some Value'],
        [
          'SETTINGS',
          JSON.stringify({
            exportTarget: {
              type: 'drive',
              config: { folder: 'My Test Folder' },
            },
          }),
        ],
      ],
    });

    frontend = FakeFrontend.withIdentity({
      ruleRangeClass: RuleRange,
      rules: [],
      version: '1.0',
      clientInitializer: () => new FakeClient('test', new FakePropertyStore()),
      migrations: [],
      properties: new FakePropertyStore(),
    });
    vi.spyOn(FakeFrontend.prototype, 'getIdentityFields').mockReturnValue({
      ID_TYPE: { label: 'ID Type', value: '' },
      OTHER_SETTING: { label: 'Other Setting', value: '' },
    });
  });

  it('should construct the settings object from named ranges and SETTINGS', () => {
    const expectedSettings = {
      dynamicData: {
        ID_TYPE: 'Campaign',
        OTHER_SETTING: 'Some Value',
      },
      exportTarget: {
        type: 'drive',
        config: { folder: 'My Test Folder' },
      },
    };

    const settings = JSON.parse(frontend.getSettings());

    expect(settings).toEqual(expectedSettings);
  });
});
