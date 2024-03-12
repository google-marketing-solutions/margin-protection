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

import {
  AppsScriptPropertyStore,
  PropertyStore,
  Values,
} from 'anomaly_library/main';
import {
  FakePropertyStore,
  FakeUtilitiesService,
  mockAppsScript,
} from 'anomaly_library/testing/mock_apps_script';
import {GENERAL_SETTINGS_SHEET} from 'common/sheet_helpers';

import {lazyLoadApp} from '../../../common/sheet_helpers';
import {Client} from '../client';
import {migrations, SearchAdsFrontEnd} from '../frontend';
import {getFrontEnd} from '../main';
import {ClientArgs, ClientInterface, RuleGranularity} from '../types';

import {FakeClient} from './client_helpers';

describe('Migrations', async () => {
  let frontend: SearchAdsFrontEnd;
  let properties: PropertyStore;

  beforeEach(() => {
    setUp();
    properties = new FakePropertyStore();
    frontend = scaffoldFrontEnd(new FakeClient(properties));
    (globalThis.Utilities as unknown as FakeUtilitiesService) =
      new FakeUtilitiesService();
  });

  it('upgrades to v1.4', () => {
    const rule = 'adGroupTargetChange-1-1';
    properties.setProperty(
      rule,
      JSON.stringify({
        '1': {
          value:
            'Type of Target:T1:My Target CHANGED, Type of Target:T2:Other Target DELETED',
          anomalous: true,
          fields: {'These are stable': 'Y'},
          internal: {
            original: {
              'Type of Target': {
                'T1:My Target': '+0%',
                'T2:Other Target': '+-0.39999%',
              },
            },
          },
        },
      }),
    );
    migrations['1.4'](frontend);

    expect(JSON.parse(properties.getProperty(rule) || '{}')).toEqual({
      '1': {
        value:
          'Type of Target:My Target CHANGED, Type of Target:Other Target DELETED',
        anomalous: true,
        fields: {'These are stable': 'Y'},
        internal: {
          original: {
            'Type of Target': {
              'My Target': '0',
              'Other Target': '-0.39999',
            },
          },
        },
      },
    });
  });

  it('upgrades to v2.0', () => {
    const store = new AppsScriptPropertyStore();
    const values: Values = {'123': {value: 'v', anomalous: true}};
    store.setProperty('test', JSON.stringify(values));
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2020-01-01T00:00:00.000Z'));
    (migrations['2.0'] as unknown as Function)();
    jasmine.clock().uninstall();

    expect(JSON.parse(store.getProperty('test') || '""')).toEqual(values);
  });
});

function setUp() {
  mockAppsScript();
  const active = SpreadsheetApp.getActive();
  let sheet: GoogleAppsScript.Spreadsheet.Sheet | null = active.getSheetByName(
    GENERAL_SETTINGS_SHEET,
  );
  if (!sheet) {
    sheet = active.insertSheet(GENERAL_SETTINGS_SHEET);
  }
  const range1 = sheet.getRange('A1');
  active.setNamedRange('AGENCY_ID', range1);
  const range2 = sheet.getRange('A2');
  active.setNamedRange('ADVERTISER_ID', range2);
}

function scaffoldFrontEnd(client?: Client) {
  const frontend = lazyLoadApp<
    ClientInterface,
    RuleGranularity,
    ClientArgs,
    SearchAdsFrontEnd
  >(getFrontEnd)(new FakePropertyStore());
  if (client) {
    (client as {properties: PropertyStore}).properties =
      frontend.client.properties;
    (frontend as typeof frontend & {client: Client}).client = client;
  }
  return frontend;
}
