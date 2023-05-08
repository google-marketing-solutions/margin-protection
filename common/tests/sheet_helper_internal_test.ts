/**
 * @license
 * Copyright 2023 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {setUpAppsScriptSimulator} from 'google3/javascript/apps/maestro/simulator/closure_apps_script_simulator-closurized';

import {AppsScriptFrontEnd, global, HELPERS, lazyLoadApp, toExport} from '../sheet_helpers';

import {Client, Granularity, RuleRange, TestClientArgs, TestClientInterface} from './helpers';
import {AppsScriptFunctions} from '../types';
import FilterCriteria = GoogleAppsScript.Spreadsheet.FilterCriteria;

describe('Check globals', async () => {
  let frontend: FakeFrontEnd;

  beforeEach(() => {
    setUp();
    frontend = lazyLoadApp<TestClientInterface, Granularity, TestClientArgs, FakeFrontEnd>(() => {
      return new FakeFrontEnd({
        ruleRangeClass: RuleRange,
        rules: [
        ],
        version: 1.0,
        clientClass: Client,
        migrations: {},
      });
    })();
  });

  it('exists in `toExport`', () => {
    expect(toExport.onOpen).toBeDefined();
    expect(toExport.initializeSheets).toBeDefined();
    expect(toExport.launchMonitor).toBeDefined();
    expect(toExport.preLaunchQa).toBeDefined();
  });

  it('exists in `global`', () => {
    expect(Object.keys(global)).toEqual(Object.keys(toExport));
    expect(global.onOpen).toBeDefined();
    expect(global.initializeSheets).toBeDefined();
    expect(global.launchMonitor).toBeDefined();
    expect(global.preLaunchQa).toBeDefined();
  });

  it('calls frontend version', () => {
    const calls = {...frontend.calls};

    toExport.onOpen();
    toExport.initializeSheets();
    toExport.launchMonitor();
    toExport.preLaunchQa();

    expect(calls.onOpen).toEqual(0);
    expect(calls.initializeSheets).toEqual(0);
    expect(calls.launchMonitor).toEqual(0);
    expect(calls.preLaunchQa).toEqual(0);
    expect(frontend.calls.onOpen).toEqual(1);
    expect(frontend.calls.initializeSheets).toEqual(1);
    expect(frontend.calls.launchMonitor).toEqual(1);
    expect(frontend.calls.preLaunchQa).toEqual(1);
  });
});

class FakeFrontEnd extends AppsScriptFrontEnd<TestClientInterface, Granularity, TestClientArgs> {
  readonly calls: Record<AppsScriptFunctions, number> = {
    onOpen: 0,
    initializeSheets: 0,
    launchMonitor: 0,
    preLaunchQa: 0,
  };

  getIdentity(): TestClientArgs {
    return {};
  }
  maybeSendEmailAlert(): void {
    return;
  }
  override async onOpen() {
    this.calls.onOpen++;
  }

  override async initializeSheets() {
    this.calls.initializeSheets++;
  }

  override async preLaunchQa() {
    this.calls.preLaunchQa++;
  }

  override async launchMonitor() {
    this.calls.launchMonitor++;
  }
}

function setUp() {
  setUpAppsScriptSimulator();
  scaffoldSheetWithNamedRanges();
  spyOn(HELPERS, 'insertRows').and.callFake((range) => range);
}

function scaffoldSheetWithNamedRanges() {
  setUpAppsScriptSimulator();

  for (const [i, [constName, value]] of [
    ['ENTITY_ID', '1'],
    ['ID_TYPE', 'Advertiser'],
    ['EMAIL_LIST', ''],
    ['LABEL', 'Acme Inc.'],
  ].entries()) {
    const range = SpreadsheetApp.getActive().getRange(`$A$${i+1}`);
    SpreadsheetApp.getActive().setNamedRange(constName, range);
    SpreadsheetApp.getActive().getRangeByName(constName)!.setValue(value);
  }
}
