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

/**
 * @fileoverview Tests the Apps Script main functions.
 *
 * This test should not be exported. It includes test libraries that aren't
 * public.
 *
 * It was too cumbersome to set up externally shareable testing for this that
 * was feature complete.
 */

// g3-format-prettier

import {
  HtmlOutput,
  setUpAppsScriptSimulator,
  spreadsheetapp,
} from 'google3/javascript/apps/maestro/simulator/closure_apps_script_simulator-closurized';
import {AssignedTargetingOption} from 'dv360_api/dv360_resources';
import {TARGETING_TYPE} from 'dv360_api/dv360_types';
import {equalTo} from 'google3/third_party/professional_services/solutions/appsscript_anomaly_library/lib/absoluteRule';
import {
  FakePropertyStore,
  FakeUtilitiesService,
} from 'google3/third_party/professional_services/solutions/appsscript_anomaly_library/lib/testing/mock_apps_script';
import {
  HELPERS,
  lazyLoadApp,
  RULE_SETTINGS_SHEET,
} from 'common/sheet_helpers';
import {
  Callback,
  ParamDefinition,
  RuleDefinition,
} from 'common/types';

import {Client, RuleRange} from '../client';
import {DisplayVideoFrontEnd, migrations} from '../frontend';
import {getFrontEnd} from '../main';
import {geoTargetRule} from '../rules';
import {ClientArgs, ClientInterface, RuleGranularity} from '../types';

import {
  CampaignTemplateConverter,
  generateTestClient,
  InsertionOrderTemplateConverter,
} from './client_helpers';

import HtmlTemplate = GoogleAppsScript.HTML.HtmlTemplate;

const FOLDER = 'application/vnd.google-apps.folder';

describe('Rule value filling', () => {
  let client: Client;
  let rules: RuleRange;

  const allCampaigns: Record<string, CampaignTemplateConverter[]> = {};
  const allInsertionOrders: Record<string, InsertionOrderTemplateConverter[]> =
    {};

  beforeEach(() => {
    client = testData({allCampaigns, allInsertionOrders});

    setUp();

    rules = new RuleRange([[]], client);
    jasmine.clock().install().mockDate(new Date('1970-03-01'));
    testData({});
    rules.fillRuleValues(geoTargetRule.definition);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('uses existing settings when adding new campaigns', async () => {
    rules.setRule('none', [
      ['ID', 'ID', 'Campaign Name'],
      ['c1', 'c1', 'Campaign 1'],
    ]);
    rules.setRule(geoTargetRule.definition.name, [
      ['ID', 'Geo Targets', 'Excluded Geo Targets'],
      ['default', '', 'New Jersey'],
      ['c1', 'United States', ''],
    ]);

    allCampaigns['1'].push((campaignTemplate) => {
      campaignTemplate.id = 'c2';
      campaignTemplate.displayName = 'Campaign 2';

      return campaignTemplate;
    });

    allInsertionOrders['1'].push((insertionOrderTemplate) => {
      insertionOrderTemplate.id = 'io2';
      insertionOrderTemplate.displayName = 'IO 2';
      insertionOrderTemplate.campaignId = 'c2';
      return insertionOrderTemplate;
    });

    (client as unknown as {storedCampaigns: []}).storedCampaigns = [];
    (client as unknown as {storedInsertionOrders: []}).storedInsertionOrders =
      [];

    await rules.fillRuleValues(geoTargetRule.definition);
    expect(rules.getRule(geoTargetRule.definition.name)).toEqual([
      ['ID', 'Geo Targets', 'Excluded Geo Targets'],
      ['default', '', 'New Jersey'],
      ['c1', 'United States', ''],
      ['c2', '', ''],
    ]);
  });

  it('uses existing settings when adding new rules', async () => {
    const geoTargetRule2: RuleDefinition<
      Record<'geotargeting' | 'excludes' | 'newrule', ParamDefinition>,
      RuleGranularity
    > = {
      ...geoTargetRule.definition,
      params: {
        ...geoTargetRule.definition.params,
        newrule: {label: 'New Rule'},
      },
      defaults: {
        ...geoTargetRule.definition.defaults,
        newrule: '',
      },
    };

    rules.setRule('none', [
      ['ID', 'ID', 'Insertion Order Name'],
      ['c1', 'c1', 'My Insertion Order'],
    ]);
    rules.setRule(geoTargetRule2.name, [
      ['ID', 'Geo Targets', 'Excluded Geo Targets'],
      ['default', 'New Jersey', ''],
      ['c1', 'United States', ''],
    ]);

    await rules.fillRuleValues(geoTargetRule2);
    expect(rules.getRule(geoTargetRule2.name)).toEqual([
      ['ID', 'Geo Targets', 'Excluded Geo Targets', 'New Rule'],
      ['default', 'New Jersey', '', ''],
      ['c1', 'United States', '', ''],
    ]);
  });

  it('removes old rules when they no longer exist', async () => {
    const geoTargetRule2: RuleDefinition<
      Record<'newrule', ParamDefinition>,
      RuleGranularity
    > = {
      name: geoTargetRule.definition.name,
      description: geoTargetRule.definition.description,
      callback: geoTargetRule.definition.callback as unknown as Callback<
        Record<'newrule', ParamDefinition>
      >,
      uniqueKeyPrefix: geoTargetRule.definition.uniqueKeyPrefix,
      granularity: geoTargetRule.definition.granularity,
      valueFormat: geoTargetRule.definition.valueFormat,
      params: {
        newrule: {label: 'New Rule'},
      },
      defaults: {
        newrule: 'foo',
      },
    };

    rules.setRule(geoTargetRule2.name, [
      ['ID', 'Geo Targets', 'Excluded Geo Targets'],
      ['default', 'New Jersey', ''],
      ['c1', 'United States', ''],
    ]);

    await rules.fillRuleValues(geoTargetRule2);
    expect(rules.getRule(geoTargetRule2.name)).toEqual([
      ['ID', 'New Rule'],
      ['default', 'foo'],
      ['c1', ''],
    ]);
  });
});

describe('Pre-Launch QA menu option', () => {
  let frontend: DisplayVideoFrontEnd;

  beforeEach(async () => {
    setUp();
    frontend = scaffoldFrontEnd(testData({}));
    HtmlService.createTemplateFromFile = (filename: string) =>
      ({evaluate: () => new HtmlOutput()}) as unknown as HtmlTemplate;
    scaffoldSheetWithNamedRanges();
    // force private methods to be visible, so we can manipulate them.
    fillInSheetStubs();
    await frontend.initializeRules();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(Date.UTC(1970, 0, 1)));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('populates rule results', async () => {
    await frontend.preLaunchQa();
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Pre-Launch QA Results',
    )!;
    expect(sheet.getDataRange().getValues()).toContain([
      'Geo Targeting',
      'Advertiser ID: 1, Campaign Name: Campaign 1, Campaign ID: c1, Number of Geos: 1',
      '1',
      'false',
    ]);
  });

  it('clears rule results that were previously set', async () => {
    const noise = Array.from<string>({length: 10})
      .fill('')
      .map(() => Array.from<string>({length: 10}).fill('lorem ipsum'));
    await frontend.preLaunchQa();

    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Pre-Launch QA Results',
    )!;
    sheet.getRange(1, 1, noise.length, noise[0].length).setValues(noise);
    const origValues = sheet.getDataRange().getValues();
    // try again
    await frontend.preLaunchQa();

    expect(origValues[9][9]).toEqual('lorem ipsum');
    expect(sheet.getDataRange().getValues()).toContain([
      'Geo Targeting',
      'Advertiser ID: 1, Campaign Name: Campaign 1, Campaign ID: c1, Number of Geos: 1',
      '1',
      'false',
    ]);
  });
});

function scaffoldFrontEnd(client?: Client) {
  const frontend = lazyLoadApp<
    ClientInterface,
    RuleGranularity,
    ClientArgs,
    DisplayVideoFrontEnd
  >(getFrontEnd)(new FakePropertyStore());
  if (client) {
    (frontend as typeof frontend & {client: Client}).client = client;
  }
  return frontend;
}

function testData(params: {
  allInsertionOrders?: Record<string, InsertionOrderTemplateConverter[]>;
  allCampaigns?: Record<string, CampaignTemplateConverter[]>;
  fakeImpressionAmount?: number;
  fakeSpendAmount?: number;
}) {
  const allAssignedTargetingOptions = {
    '1': {
      ['c1']: ['United States'].map(
        (geoTarget) =>
          new AssignedTargetingOption(
            'geo1',
            TARGETING_TYPE.GEO_REGION,
            '',
            '',
            {'displayName': geoTarget},
          ),
      ),
    },
  };

  (params.allCampaigns ??= {})['1'] = [(campaign) => campaign];
  (params.allInsertionOrders ??= {})['1'] = [(io) => io];

  return generateTestClient({
    id: '1',
    allAssignedTargetingOptions,
    ...params,
  });
}

describe('Matrix to CSV', () => {
  let frontend: DisplayVideoFrontEnd;

  beforeEach(() => {
    setUp();
    frontend = scaffoldFrontEnd();
  });

  it('Handles simple 2-d arrays', () => {
    const matrix = [
      ['a1', 'b1', 'c1'],
      ['a2', 'b2', 'c2'],
      ['a3', 'b3', 'c3'],
    ];
    expect(
      frontend.matrixToCsv(matrix, {
        category: 'dv360',
        sheetId: 'a',
        ruleName: 'rule1',
        label: 'label',
        'currentTime': '2020-01-01T00:00:00.000Z',
      }),
    ).toEqual(
      '"Category","Sheet ID","Label","Rule Name","Current Time","a1","b1","c1"\n"dv360","a","label","rule1","2020-01-01T00:00:00.000Z","a2","b2","c2"\n"dv360","a","label","rule1","2020-01-01T00:00:00.000Z","a3","b3","c3"',
    );
  });

  it('Handles complex 2-d arrays', () => {
    const matrix = [
      ['Not another CSV function!'],
      [`Famous last words, like "This format probably won't happen!"`],
    ];
    expect(
      frontend.matrixToCsv(matrix, {
        category: 'dv360',
        sheetId: 'a',
        ruleName: 'rule1',
        label: 'label',
        currentTime: '2020-01-01T00:00:00.000Z',
      }),
    ).toEqual(
      `"Category","Sheet ID","Label","Rule Name","Current Time","Not another CSV function!"\n"dv360","a","label","rule1","2020-01-01T00:00:00.000Z","Famous last words, like """This format probably won't happen!""""`,
    );
  });
});

interface FakeFiles {
  currentId: number;
  drives: Record<string, GoogleAppsScript.Drive.Schema.File>;
  folders: Record<string, GoogleAppsScript.Drive.Schema.File[]>;
  files: Record<string, GoogleAppsScript.Drive.Schema.File>;
  get(id: string): GoogleAppsScript.Drive.Schema.File;
  list(): {items?: GoogleAppsScript.Drive.Schema.File[]};
  list({q}: {q?: string}): {items?: GoogleAppsScript.Drive.Schema.File[]};
  insert(
    schema: GoogleAppsScript.Drive.Schema.File,
    file: GoogleAppsScript.Base.Blob,
  ): GoogleAppsScript.Drive.Schema.File;
}
const fakeFiles: FakeFiles = {
  currentId: 0,
  drives: {},
  folders: {},
  files: {},
  list({driveId, q}: {driveId?: string; q?: string} = {}) {
    if (!q) {
      return {items: undefined};
    }
    const title: string | null = (q.match(/title="([^"]+)"/) || [])[1];
    return {items: this.folders[title]};
  },
  insert(
    schema: GoogleAppsScript.Drive.Schema.File,
    file: GoogleAppsScript.Base.Blob,
  ) {
    if (!schema.title) {
      throw new Error('A schema title is expected.');
    }
    for (const p of schema.parents || []) {
      (this.folders[p.id!] ??= []).push(schema);
    }
    schema.id = schema.id || String(++this.currentId);
    this.files[schema.title] = schema;
    return schema;
  },
  get(id: string) {
    return this.drives[id];
  },
};

describe('Export as CSV', () => {
  let frontend: DisplayVideoFrontEnd;
  let oldDrive: GoogleAppsScript.Drive;

  beforeEach(() => {
    setUp();
    frontend = scaffoldFrontEnd();
    oldDrive = Drive;
    Drive.Files =
      fakeFiles as unknown as GoogleAppsScript.Drive.Collection.FilesCollection;
    const range1 = SpreadsheetApp.getActive().getActiveSheet().getRange('Z10');
    const range2 = SpreadsheetApp.getActive().getActiveSheet().getRange('Z11');
    SpreadsheetApp.getActive().setNamedRange('REPORT_LABEL', range1);
    SpreadsheetApp.getActive().setNamedRange('DRIVE_ID', range2);
    SpreadsheetApp.getActive()
      .getRangeByName('REPORT_LABEL')!
      .setValue('Acme Inc.');
    SpreadsheetApp.getActive().getRangeByName('DRIVE_ID')!.setValue('123abc');
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('January 1, 1970 00:00:00 GMT'));
  });

  afterEach(() => {
    Drive = oldDrive;
    jasmine.clock().uninstall();
  });

  it('saves the file', () => {
    fakeFiles.drives['123abc'] = {
      id: '123abc',
      mimeType: FOLDER,
      title: 'launch_monitor',
    };
    frontend.exportAsCsv('my rule', [['it works!']]);
    const folderId = fakeFiles.files['reports'];
    expect(fakeFiles.folders[folderId.id!]).toEqual([
      jasmine.objectContaining({
        id: '2',
        mimeType: 'text/plain',
        parents: [{id: '1'}],
      }),
    ]);

    for (const value of [
      'Acme Inc.',
      'my rule',
      '1970-01-01T00:00:00.000Z.csv',
    ]) {
      expect(Object.keys(fakeFiles.files)[1].split('_')).toContain(value);
    }
  });
});

describe('Fill rule values', () => {
  let rules: RuleRange;
  let frontend: DisplayVideoFrontEnd;

  beforeEach(async () => {
    setUp();
    frontend = scaffoldFrontEnd(testData({}));
    rules = new RuleRange([[]], frontend.client);
    fillInSheetStubs();
    await frontend.initializeRules();
  });
  it('removes extra fields', () => {
    const noise = Array.from<string>({length: 10})
      .fill('')
      .map((unused) => Array.from<string>({length: 10}).fill('lorem ipsum'));
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      RULE_SETTINGS_SHEET + ' - Insertion Order',
    )!;
    sheet.clear();
    sheet.getRange(1, 1, noise.length, noise[0].length).setValues(noise);
    rules.fillRuleValues(geoTargetRule.definition);
    expect(rules.getValues()[0].length).toEqual(4);
  });
});

describe('getMatrixOfResults', () => {
  let frontend: DisplayVideoFrontEnd;

  beforeEach(() => {
    setUp();
    frontend = scaffoldFrontEnd();
  });

  it('Provides 2-d array from a set of values with no fields.', async () => {
    const rule = equalTo({
      uniqueKey: 'rule',
      thresholdValue: 1,
      propertyStore: frontend.client.properties,
    });
    const result = frontend.getMatrixOfResults('value1', [rule.createValue(1)]);
    expect(result).toEqual([
      ['value1', 'anomalous'],
      ['1', 'false'],
    ]);
  });
  it('Provides 2-d array from a set of values with fields.', async () => {
    const rule = equalTo({
      uniqueKey: 'rule',
      thresholdValue: 1,
      propertyStore: frontend.client.properties,
    });
    const result = frontend.getMatrixOfResults('value2', [
      rule.createValue(1, {'test1': 'a', 'test2': 'b'}),
    ]);
    expect(result).toEqual([
      ['value2', 'anomalous', 'test1', 'test2'],
      ['1', 'false', 'a', 'b'],
    ]);
  });
});

describe('initializeRules', () => {
  const allCampaigns: {[advertiserId: string]: CampaignTemplateConverter[]} =
    {};
  const expectedValues = [
    [
      '',
      '',
      'Budget Pacing by Days Ahead/Behind',
      '',
      'Budget Pacing by Percent Ahead',
      '',
      'Budget Per Day',
      '',
      'Impressions by Geo Target',
      '',
    ],
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Use the 2-digit country codes found in this report.',
      '',
    ],
    [
      'ID',
      'Insertion Order Name',
      'Min. Days Ahead/Behind (+/-)',
      'Max. Days Ahead/Behind (+/-)',
      'Min. Percent Ahead/Behind',
      'Max. Percent Ahead/Behind',
      'Min. Daily Budget',
      'Max. Daily Budget',
      'Allowed Countries (Comma Separated)',
      'Max. Percent Outside Geos',
    ],
    ['default', '', '-1', '1', '0', '0.5', '0', '1000000', 'US', '0.01'],
    ['io1', 'Insertion Order 1', '', '', '', '', '', '', '', ''],
  ];

  let frontend: DisplayVideoFrontEnd;

  beforeEach(async () => {
    setUp();
    frontend = scaffoldFrontEnd(testData({allCampaigns}));
    jasmine.clock().install().mockDate(new Date('1970-03-01'));
    fillInSheetStubs();
    await frontend.initializeRules();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('creates a settings page', () => {
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Rule Settings - Insertion Order',
    );
    expect(sheet).toBeTruthy();
  });

  it('has settings populated', () => {
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Rule Settings - Insertion Order',
    )!;
    expect(sheet.getDataRange().getValues()).toEqual(expectedValues);
  });
});

describe('Migrations', () => {
  let frontend: DisplayVideoFrontEnd;

  beforeEach(() => {
    setUp();
    frontend = scaffoldFrontEnd();
    (globalThis.Utilities as unknown as FakeUtilitiesService) =
      new FakeUtilitiesService();
    (frontend as typeof frontend & {client: Client}).client = testData({});
    PropertiesService.getScriptProperties().setProperty('sheet_version', '0.1');
  });

  it('upgrades to v1.1', async () => {
    testData({});
    const ruleRange = new RuleRange([[]], frontend.client);
    fillInSheetStubs();
    await frontend.initializeRules();

    for (const rule of Object.values(frontend.rules)) {
      await ruleRange.fillRuleValues(rule.definition);
    }
    const values = ruleRange.getValues();
    const active = SpreadsheetApp.getActive();

    active.deleteSheet(active.getSheetByName('Rule Settings - Campaign')!);
    active.deleteSheet(
      active.getSheetByName('Rule Settings - Insertion Order')!,
    );
    active
      .insertSheet('Rule Settings')
      .getRange(1, 1, values.length, values[0].length)
      .setValues(values);
    expect(active.getSheetByName('Rule Settings')).toBeTruthy();
    migrations['1.1'](frontend);

    expect(active.getSheetByName('Rule Settings')).toBeNull();
  });

  it('upgrades to v1.2', () => {
    testData({});
    PropertiesService.getScriptProperties().setProperty(
      'geo-123',
      '{"json": "object"}',
    );

    migrations['1.2'](frontend);

    const property =
      PropertiesService.getScriptProperties().getProperty('geo-123')!;
    expect(property.startsWith('gzipped:')).toBeTruthy();
  });

  it('upgrades to v1.3', () => {
    migrations['1.3'](frontend);

    expect(SpreadsheetApp.getActive().getRangeByName('DRIVE_ID')).toBeTruthy();
    expect(
      SpreadsheetApp.getActive().getRangeByName('REPORT_LABEL'),
    ).toBeTruthy();
  });
});

function fillInSheetStubs() {
  spreadsheetapp.Sheet.prototype.getBandings = () => [];
  SpreadsheetApp.BandingTheme = {
    BLUE: 0,
    LIGHT_GREY: 1,
    CYAN: 2,
    YELLOW: 3,
    GREEN: 4,
    ORANGE: 5,
    TEAL: 6,
    GREY: 7,
    BROWN: 8,
    LIGHT_GREEN: 9,
    INDIGO: 10,
    PINK: 11,
  };
  spreadsheetapp.Range.prototype.applyRowBanding = (
    theme: GoogleAppsScript.Spreadsheet.BandingTheme,
  ) => {
    return;
  };
}

function setUp() {
  setUpAppsScriptSimulator();
  scaffoldSheetWithNamedRanges();
  spyOn(HELPERS, 'insertRows').and.callFake((range) => range);
  spyOn(HELPERS, 'getSheetId').and.callFake(() => 'id1');
}

function scaffoldSheetWithNamedRanges() {
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
