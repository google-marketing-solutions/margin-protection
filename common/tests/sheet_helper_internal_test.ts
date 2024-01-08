/**
 * @license
 * Copyright 2023 Google LLC.
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

// g3-format-prettier
import {setUpAppsScriptSimulator} from 'google3/javascript/apps/maestro/simulator/closure_apps_script_simulator-closurized';
import {AppsScriptPropertyStore} from 'anomaly_library/main';

import {
  AppsScriptFrontEnd,
  HELPERS,
  lazyLoadApp,
  toExport,
} from '../sheet_helpers';
import {AppsScriptFunctions, FrontEndArgs} from '../types';

import {
  Client,
  Granularity,
  RuleRange,
  TestClientArgs,
  TestClientInterface,
} from './helpers';

describe('Check globals', async () => {
  let frontend: FakeFrontEnd;

  beforeEach(() => {
    setUp();
    frontend = lazyLoadApp<
      TestClientInterface,
      Granularity,
      TestClientArgs,
      FakeFrontEnd
    >((properties) => {
      return new FakeFrontEnd({
        ruleRangeClass: RuleRange,
        rules: [],
        version: '1.0',
        clientClass: Client,
        migrations: {},
        properties,
      });
    })(new AppsScriptPropertyStore());
  });

  it('exists in `toExport`', () => {
    expect(toExport.onOpen).toBeDefined();
    expect(toExport.initializeSheets).toBeDefined();
    expect(toExport.launchMonitor).toBeDefined();
    expect(toExport.preLaunchQa).toBeDefined();
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

class FakeFrontEnd extends AppsScriptFrontEnd<
  TestClientInterface,
  Granularity,
  TestClientArgs,
  FakeFrontEnd
> {
  readonly calls: Record<AppsScriptFunctions, number> = {
    onOpen: 0,
    initializeSheets: 0,
    launchMonitor: 0,
    preLaunchQa: 0,
    displaySetupGuide: 0,
    displayGlossary: 0,
  };

  constructor(
    args: FrontEndArgs<
      TestClientInterface,
      Granularity,
      TestClientArgs,
      FakeFrontEnd
    >,
  ) {
    super('Fake', args);
  }

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
    await super.initializeSheets();
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
    const range = SpreadsheetApp.getActive().getRange(`$A$${i + 1}`);
    SpreadsheetApp.getActive().setNamedRange(constName, range);
    SpreadsheetApp.getActive().getRangeByName(constName)!.setValue(value);
  }
}

describe('Test migration order', () => {
  const list: string[] = [];
  const CURRENT_SHEET_VERSION = '2.2.0';
  const migrations = {
    '3.0': () => list.push('3.0'),
    '2.1.4': () => list.push('2.1.4'),
    '2.0': () => list.push('2.0'),
    '2.1.0': () => list.push('2.1.0'),
    '2.2.0': () => list.push('2.2.0'),
  };

  function setFrontEnd({
    expectedVersion,
    currentVersion,
  }: {
    expectedVersion: string;
    currentVersion: string;
  }) {
    PropertiesService.getScriptProperties().setProperty(
      'sheet_version',
      currentVersion,
    );
    return lazyLoadApp<
      TestClientInterface,
      Granularity,
      TestClientArgs,
      FakeFrontEnd
    >((properties) => {
      return new FakeFrontEnd({
        ruleRangeClass: RuleRange,
        rules: [],
        version: expectedVersion,
        clientClass: Client,
        migrations,
        properties,
      });
    })(new AppsScriptPropertyStore());
  }

  beforeEach(() => {
    setUp();
  });

  afterEach(() => {
    list.splice(0, list.length);
  });

  it('migrates all', () => {
    const frontend = setFrontEnd({
      expectedVersion: '5.0',
      currentVersion: '1.0',
    });
    frontend.migrate();
    expect(list).toEqual(['2.0', '2.1.0', '2.1.4', '2.2.0', '3.0']);
  });

  it('partially migrates', () => {
    const frontend = setFrontEnd({
      expectedVersion: '5.0',
      currentVersion: '2.1.0',
    });
    frontend.migrate();
    expect(list).toEqual(['2.1.4', '2.2.0', '3.0']);
  });

  it('runs when initializeSheets runs', async () => {
    const frontend = setFrontEnd({
      expectedVersion: CURRENT_SHEET_VERSION,
      currentVersion: '1.0',
    });
    scaffoldSheetWithNamedRanges();
    spyOn(HtmlService, 'createTemplateFromFile').and.stub();
    PropertiesService.getScriptProperties().setProperty('sheet_version', '0.1');
    await frontend.initializeSheets();
    expect(
      PropertiesService.getScriptProperties().getProperty('sheet_version'),
    ).toEqual(String(CURRENT_SHEET_VERSION));
  });

  it('does not run migrations if version is up-to-date', () => {
    const frontend = setFrontEnd({
      expectedVersion: CURRENT_SHEET_VERSION,
      currentVersion: '1.0',
    });
    // NOTE - do not change this test. Change `CURRENT_SHEET_VERSION` instead.
    PropertiesService.getScriptProperties().setProperty(
      'sheet_version',
      String(CURRENT_SHEET_VERSION),
    );
    const numberRun = frontend.migrate();
    expect(numberRun).toEqual(0);
  });

  it('migrates only to specified version cap', () => {
    const frontend = setFrontEnd({
      expectedVersion: '2.1.0',
      currentVersion: '2.1.0',
    });
    const numberOfMigrations = frontend.migrate();
    expect(list).toEqual([]);
    expect(numberOfMigrations).toEqual(0);
  });
});
