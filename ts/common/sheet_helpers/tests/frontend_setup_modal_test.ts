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

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(async () => {
  const { mockAppsScript } = (await vi.importActual(
    '#common/test_helpers/mock_apps_script.js',
  )) as typeof import('#common/test_helpers/mock_apps_script.js');
  mockAppsScript();
});

import { FakeFrontend, RuleRange } from '../../tests/helpers.js';
import { DriveExporter } from '../../exporters/drive_exporter.js';
import { BigQueryStrategyExporter } from '../../exporters/bigquery_exporter.js';
import { ExportContext } from '../../exporter.js';

vi.mock('../../exporter.js');
vi.mock('../../exporters/drive_exporter.js');
vi.mock('../../exporters/bigquery_exporter.js');

import { scaffoldSheetWithNamedRanges } from '../../tests/helpers.js';
import { FakePropertyStore } from '#common/test_helpers/mock_apps_script.js';

describe('AppsScriptFrontend Setup Modal', () => {
  let frontend: FakeFrontend;

  beforeEach(() => {
    vi.clearAllMocks();
    scaffoldSheetWithNamedRanges();
    frontend = FakeFrontend.withIdentity({
      clientInitializer: vi.fn(),
      ruleRangeClass: RuleRange,
      rules: [],
      properties: new FakePropertyStore(),
      migrations: [],
      version: '1',
    });
  });

  it('getSettings retrieves from property store', () => {
    const mockSettings = { foo: 'bar' };
    SpreadsheetApp.getActive()
      .getRangeByName('SETTINGS')!
      .setValue(JSON.stringify(mockSettings));
    const settings = frontend.getSettings();
    expect(settings).toEqual(JSON.stringify(mockSettings));
  });

  it('handleInput saves settings to the property store', () => {
    const mockPayload = { dynamicData: { file_one: 'test' } };
    frontend.handleInput('update:settings', mockPayload);
    const settings = SpreadsheetApp.getActive()
      .getRangeByName('SETTINGS')!
      .getValue();
    expect(settings).toEqual(JSON.stringify(mockPayload));
  });

  describe('displaySetupGuide', () => {
    it('calls the template functions correctly', () => {
      const createTemplateSpy = vi.spyOn(HtmlService, 'createTemplateFromFile');
      const mockShowModal = vi.fn();
      const mockUi = {
        showModalDialog: mockShowModal,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(SpreadsheetApp, 'getUi').mockReturnValue(mockUi as any);

      frontend.displaySetupGuide();

      expect(createTemplateSpy).toHaveBeenCalledWith('html/setup');
      const modalContent = mockShowModal.mock.calls[0][0];
      expect(modalContent.getWidth()).toBe(450);
      expect(modalContent.getHeight()).toBe(600);
      expect(mockShowModal).toHaveBeenCalledWith(
        expect.any(Object),
        'Export Settings',
      );
    });

    it('correctly evaluates and injects data into the template', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const htmlPath = path.resolve(__dirname, '../../public/html/setup.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');

      const dynamicFields = ['file_one', 'file_two'];
      const populatedContent = htmlContent.replace(
        '<?!= dynamicFields ?>',
        JSON.stringify(dynamicFields),
      );

      const expectedJs = 'const dynamicFields = ["file_one","file_two"] || {};';
      expect(populatedContent).toContain(expectedJs);
    });
  });

  describe('exportData with new settings', () => {
    it('defaults to DriveExporter when no settings are present', () => {
      frontend.exportData('MyRule', [['header'], ['data']]);
      expect(ExportContext).toHaveBeenCalledWith(expect.any(DriveExporter));
    });

    it('uses DriveExporter when type is "drive"', () => {
      const settings = {
        exportTarget: { type: 'drive', config: { folder: 'MyFolder' } },
      };
      SpreadsheetApp.getActive()
        .getRangeByName('SETTINGS')!
        .setValue(JSON.stringify(settings));
      frontend.exportData('MyRule', [['header'], ['data']]);
      expect(ExportContext).toHaveBeenCalledWith(expect.any(DriveExporter));
    });

    it('uses BigQueryStrategyExporter when type is "bigquery"', () => {
      const settings = {
        exportTarget: {
          type: 'bigquery',
          config: { projectId: 'gcp-1', datasetId: 'my_set' },
        },
      };
      SpreadsheetApp.getActive()
        .getRangeByName('SETTINGS')!
        .setValue(JSON.stringify(settings));
      frontend.exportData('MyRule', [['header'], ['data']]);
      expect(ExportContext).toHaveBeenCalledWith(
        expect.any(BigQueryStrategyExporter),
      );
      expect(BigQueryStrategyExporter).toHaveBeenCalledWith('gcp-1', 'my_set');
    });
  });
});
