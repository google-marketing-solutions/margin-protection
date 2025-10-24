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

import 'jasmine';

import { mockAppsScript } from '#common/test_helpers/mock_apps_script.js';
import { AppsScriptFrontend } from '#common/sheet_helpers/frontend.js';
import { FrontendArgs } from '#common/types.js';
import { LABEL_RANGE } from '#common/sheet_helpers/constants.js';
import { TestClientTypes } from '#common/tests/helpers.js';

const ENTITY_ID = 'ENTITY_ID';
const ID_TYPE = 'ID_TYPE';

describe('AppsScriptFrontend Identity', () => {
  beforeEach(() => {
    mockAppsScript();
  });

  // A concrete implementation for testing purposes.
  class TestFrontend extends AppsScriptFrontend<TestClientTypes> {
    constructor(args: FrontendArgs<TestClientTypes>) {
      super('test', { ...args, clientInitializer: () => ({}) } as never);
    }
    getIdentity() {
      return { label: 'Test' };
    }
    public getIdentityFieldValue(rangeName: string): string {
      return super.getIdentityFieldValue(rangeName);
    }
    getIdentityFields() {
      return {
        label: {
          label: 'Label',
          value: this.getIdentityFieldValue(LABEL_RANGE),
        },
        id: {
          label: 'Entity ID',
          value: this.getIdentityFieldValue(ENTITY_ID),
        },
        idType: {
          label: 'ID Type',
          value: this.getIdentityFieldValue(ID_TYPE),
        },
        ...super.getIdentityFields(),
      };
    }
  }

  it('getIdentityFieldValue returns value for existing named range', () => {
    const spreadsheet = SpreadsheetApp.getActive();
    const sheet = spreadsheet.getActiveSheet();

    const labelRange = sheet.getRange('A1');
    labelRange.setValue('Test Label');
    spreadsheet.setNamedRange(LABEL_RANGE, labelRange);

    const idRange = sheet.getRange('B1');
    idRange.setValue('12345');
    spreadsheet.setNamedRange(ENTITY_ID, idRange);

    const idTypeRange = sheet.getRange('C1');
    idTypeRange.setValue('Advertiser');
    spreadsheet.setNamedRange(ID_TYPE, idTypeRange);

    const frontend = new TestFrontend({} as FrontendArgs<TestClientTypes>);
    const fields = frontend.getIdentityFields();

    expect(fields['label']).toEqual({ label: 'Label', value: 'Test Label' });
    expect(fields['id']).toEqual({ label: 'Entity ID', value: '12345' });
    expect(fields['idType']).toEqual({
      label: 'ID Type',
      value: 'Advertiser',
    });
  });

  it('getIdentityFieldValue returns empty string for non-existent named range', () => {
    const frontend = new TestFrontend({} as FrontendArgs<TestClientTypes>);
    const fields = frontend.getIdentityFields();

    expect(fields['label']).toEqual({ label: 'Label', value: '' });
  });

  it('getIdentityFieldValue returns empty string for existing named range with no value', () => {
    const spreadsheet = SpreadsheetApp.getActive();
    const sheet = spreadsheet.getActiveSheet();
    const range = sheet.getRange('A1');
    spreadsheet.setNamedRange(LABEL_RANGE, range);
    // A1 has no value.

    const frontend = new TestFrontend({} as FrontendArgs<TestClientTypes>);
    const fields = frontend.getIdentityFields();

    expect(fields['label']).toEqual({ label: 'Label', value: '' });
  });

  it('getIdentityFields on base class returns an empty object', () => {
    class BaseTestFrontend extends AppsScriptFrontend<TestClientTypes> {
      constructor(args: FrontendArgs<TestClientTypes>) {
        super('test', { ...args, clientInitializer: () => ({}) } as never);
      }
      getIdentity() {
        return { label: 'Test' };
      }
    }
    const frontend = new BaseTestFrontend({} as FrontendArgs<TestClientTypes>);
    const fields = frontend.getIdentityFields();
    expect(fields).toEqual({});
  });
});
