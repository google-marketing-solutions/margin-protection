// @vitest-environment jsdom
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

import 'vitest-dom/extend-expect';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import {
  fireEvent,
  waitFor,
  getByLabelText,
  getByText,
} from '@testing-library/dom';
import { projectRoot } from '#common/utils.js';

// Helper to load and set up the HTML environment
function loadHtmlAndScripts(dynamicFields: object, settings: object | null) {
  const htmlPath = path.resolve(projectRoot, 'common/public/html/setup.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  // Inject the server-side variables into the HTML
  const populatedHtml = htmlContent
    .replace('<?!= dynamicFields ?>', JSON.stringify(dynamicFields))
    .replace('<?!= settings ?>', JSON.stringify(settings));
  const dom = new JSDOM(populatedHtml, {
    runScripts: 'dangerously',
    url: 'https://localhost/',
  });

  // Mock google.script.run
  dom.window.google = {
    script: {
      run: {
        withSuccessHandler: vi.fn().mockReturnThis(),
        withFailureHandler: vi.fn().mockReturnThis(),
        handleInput: vi.fn(),
      },
      host: {
        close: vi.fn(),
      },
    },
  };
  return dom.window;
}

describe('setup.html client-side behavior', () => {
  const mockDynamicFields = {
    loginCustomerId: { label: 'Login Customer ID', value: '123' },
    customerIds: { label: 'Customer IDs', value: '456' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dynamic fields and populate them from settings.dynamicData', () => {
    const mockSettings = {
      dynamicData: {
        loginCustomerId: 'abc',
        customerIds: 'def',
      },
    };
    const domWindow = loadHtmlAndScripts(mockDynamicFields, mockSettings);
    expect(
      getByLabelText(domWindow.document.body, 'Login Customer ID'),
    ).toHaveValue('abc');
    expect(getByLabelText(domWindow.document.body, 'Customer IDs')).toHaveValue(
      'def',
    );
  });

  it('should correctly populate export target settings', () => {
    const mockSettings = {
      exportTarget: {
        type: 'bigquery',
        config: {
          projectId: 'gcp-123',
          datasetId: 'my_dataset',
          tablePrefix: 'prefix_',
        },
      },
    };
    const domWindow = loadHtmlAndScripts(mockDynamicFields, mockSettings);

    expect(getByLabelText(domWindow.document.body, 'BigQuery')).toBeChecked();
    expect(getByLabelText(domWindow.document.body, 'Project ID')).toHaveValue(
      'gcp-123',
    );
    expect(getByLabelText(domWindow.document.body, 'Dataset ID')).toHaveValue(
      'my_dataset',
    );
    expect(
      getByLabelText(domWindow.document.body, 'Table Prefix (Optional)'),
    ).toHaveValue('prefix_');
  });

  it('should handle form submission with the dynamicData wrapper', async () => {
    const domWindow = loadHtmlAndScripts(mockDynamicFields, null);
    console.log({ domWindow: domWindow.document.querySelectorAll('button') });

    getByLabelText<HTMLFormElement>(
      domWindow.document.body,
      'Login Customer ID',
    ).value = 'new-login';
    getByLabelText<HTMLFormElement>(
      domWindow.document.body,
      'Folder to Use (Optional)',
    ).value = 'My Drive Folder';

    // Submit the form
    fireEvent.click(getByText(domWindow.document.body, 'Save & Close'));

    await waitFor(() => {
      expect(domWindow.google.script.run.handleInput).toHaveBeenCalledWith(
        'update:settings',
        {
          dynamicData: {
            loginCustomerId: 'new-login',
            customerIds: '456', // Unchanged from mock
          },
          exportTarget: {
            type: 'drive',
            config: { folder: 'My Drive Folder' },
          },
        },
      );
    });
  });

  it('should show an alert on submission failure', async () => {
    const domWindow = loadHtmlAndScripts(mockDynamicFields, null);
    const alertSpy = vi.spyOn(domWindow, 'alert').mockImplementation(() => {});
    fireEvent.click(getByLabelText(domWindow.document.body, 'Google Drive'));
    getByLabelText<HTMLFormElement>(
      domWindow.document.body,
      'Folder to Use (Optional)',
    ).value = 'My Drive Folder';

    let failureHandler: (error: Error) => void;
    domWindow.google.script.run.withFailureHandler.mockImplementation(
      (handler) => {
        failureHandler = handler;
        return domWindow.google.script.run; // Return this for chaining
      },
    );

    domWindow.google.script.run.handleInput.mockImplementation(() => {
      failureHandler(new Error('Test error'));
    });

    fireEvent.click(getByText(domWindow.document.body, 'Save & Close'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error saving settings: Test error',
      );
    });
  });
});
