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
 * @fileoverview Tests for sheet helpers.
 */

import {
  FakePropertyStore,
  mockAppsScript,
} from '../test_helpers/mock_apps_script';
import { ParamDefinition, RuleExecutorClass, RuleGetter } from '../types';

import {
  HELPERS,
  SettingMap,
  sortMigrations,
  transformToParamValues,
} from '../sheet_helpers';

import {
  FakeClient,
  FakeFrontend,
  Granularity,
  newRule,
  RuleRange,
  scaffoldSheetWithNamedRanges,
  TestClientInterface,
  TestClientTypes,
} from './helpers';
import { equalTo } from 'common/checks';

function setUp() {
  mockAppsScript();
  spyOn(HELPERS, 'insertRows').and.callFake((range) => range);
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

  function setFrontend({
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
    return new FakeFrontend({
      ruleRangeClass: RuleRange,
      rules: [],
      version: expectedVersion,
      clientInitializer: () => new FakeClient(),
      migrations,
      properties: new FakePropertyStore(),
    });
  }

  beforeEach(() => {
    mockAppsScript();
  });

  afterEach(() => {
    list.splice(0, list.length);
  });

  it('migrates all', () => {
    const frontend = setFrontend({
      expectedVersion: '5.0',
      currentVersion: '1.0',
    });
    frontend.migrate();
    expect(list).toEqual(['2.0', '2.1.0', '2.1.4', '2.2.0', '3.0']);
  });

  it('partially migrates', () => {
    const frontend = setFrontend({
      expectedVersion: '5.0',
      currentVersion: '2.1.0',
    });
    frontend.migrate();
    expect(list).toEqual(['2.1.4', '2.2.0', '3.0']);
  });

  it('runs when initializeSheets runs', async () => {
    const frontend = setFrontend({
      expectedVersion: CURRENT_SHEET_VERSION,
      currentVersion: '1.0',
    });
    mockAppsScript();
    spyOn(HtmlService, 'createTemplateFromFile').and.stub();
    PropertiesService.getScriptProperties().setProperty('sheet_version', '0.1');
    await frontend.initializeSheets();
    expect(
      PropertiesService.getScriptProperties().getProperty('sheet_version'),
    ).toEqual(String(CURRENT_SHEET_VERSION));
  });

  it('does not run migrations if version is up-to-date', () => {
    const frontend = setFrontend({
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
    const frontend = setFrontend({
      expectedVersion: '2.1.0',
      currentVersion: '2.1.0',
    });
    const numberOfMigrations = frontend.migrate();
    expect(list).toEqual([]);
    expect(numberOfMigrations).toEqual(0);
  });
});

describe('2-D array', () => {
  let array2d: string[][];
  const params = { rule1: { label: 'Rule 1' }, rule2: { label: 'Rule 2' } };

  beforeEach(() => {
    array2d = [
      ['', 'Rule 1', 'Rule 2'],
      ['1', 'A', 'B'],
      ['2', 'C', 'D'],
    ];
  });

  it('transforms into a param', () => {
    expect(transformToParamValues(array2d, params)).toEqual(
      new SettingMap([
        ['1', { rule1: 'A', rule2: 'B' }],
        ['2', { rule1: 'C', rule2: 'D' }],
      ]),
    );
  });

  it('triggers an error if empty', () => {
    const error = new Error(
      'Expected a grid with row and column headers of at least size 2',
    );
    expect(() => transformToParamValues([], params)).toThrow(error);
    expect(() => transformToParamValues([[]], params)).toThrow(error);
    expect(() => transformToParamValues([['']], params)).toThrow(error);
  });
});

describe('Rule Settings helper functions', () => {
  let rules: RuleRange;

  const client = generateTestClient({ id: '1' });
  beforeEach(() => {
    rules = initializeRuleRange(client);
    for (const rule of ['', 'Category A', 'Category B', 'Category C']) {
      // getValues() expects a rule to be in the ruleStore for the helper value.
      client.ruleStore[rule] = {
        helper: '',
        granularity: 'default',
      } as unknown as (typeof client.ruleStore)[keyof typeof client.ruleStore];
    }
  });

  it('break down a settings sheet into the correct categories', () => {
    expect(
      (
        rules as unknown as {
          rules: Record<string, Array<string[] | undefined>>;
        }
      ).rules,
    ).toEqual({
      none: [['id', 'name'], undefined, ['1', 'one']],
      'Category A': [['Header 1', 'Header 2'], undefined, ['Col 1', 'Col 2']],
      'Category B': [
        ['Header 3', 'Header 4', 'Header 5'],
        undefined,
        ['Col 3', 'Col 4', 'Col 5'],
      ],
      'Category C': [['Header 6'], undefined, ['Col 6']],
    });
  });

  it('combines categories back into a settings sheet', () => {
    expect(rules.getRule('Category A')).toEqual([
      ['id', 'Header 1', 'Header 2'],
      ['1', 'Col 1', 'Col 2'],
    ]);
  });

  it('writes back to the spreadsheet - base case', () => {
    mockAppsScript();
    rules.writeBack(Granularity.DEFAULT);
    const expected = [
      ['', '', 'Category A', '', 'Category B', '', '', 'Category C'],
      ['', '', '', '', '', '', '', ''],
      [
        'id',
        'name',
        'Header 1',
        'Header 2',
        'Header 3',
        'Header 4',
        'Header 5',
        'Header 6',
      ],
      ['1', 'one', 'Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'],
    ];
    const range = HELPERS.getOrCreateSheet(`Rule Settings - default`).getRange(
      1,
      1,
      expected.length,
      expected[0].length,
    );
    expect(range.getValues()).toEqual(expected);
  });

  it('writes back to the spreadsheet - cares about changes', () => {
    mockAppsScript();
    const sheet = HELPERS.getOrCreateSheet('Rule Settings - default');
    rules.writeBack(Granularity.DEFAULT);
    const expected = [
      ['', '', 'Category A', '', 'Category B', '', '', 'Category C'],
      ['', '', '', '', '', '', '', ''],
      [
        'id',
        'name',
        'Header 1',
        'Header 2',
        'Header 3',
        'Header 4',
        'Header 5',
        'Header 6',
      ],
      ['1', 'one', 'Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'],
    ];
    const range = sheet.getRange(1, 1, expected.length, expected[0].length);
    expected[3][2] = 'New Col 1';
    range.setValues(expected);
    rules.writeBack(Granularity.DEFAULT);

    expect(range.getValues()).toEqual([
      ['', '', 'Category A', '', 'Category B', '', '', 'Category C'],
      ['', '', '', '', '', '', '', ''],
      [
        'id',
        'name',
        'Header 1',
        'Header 2',
        'Header 3',
        'Header 4',
        'Header 5',
        'Header 6',
      ],
      ['1', 'one', 'New Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'],
    ]);
  });
});

describe('SettingMap#getOrDefault', () => {
  it('returns value', () => {
    const settingMap = new SettingMap([
      ['default', { rule1: 'A' }],
      ['1', { rule1: 'C' }],
    ]);
    expect(settingMap.getOrDefault('1').rule1).toEqual('C');
  });

  it('returns defaults when value is blank', () => {
    const settingMap = new SettingMap([
      ['default', { rule1: 'A' }],
      ['1', { rule1: '' }],
    ]);
    expect(settingMap.getOrDefault('1').rule1).toEqual('A');
  });

  it('returns value when value is 0', () => {
    const settingMap = new SettingMap([
      ['default', { rule1: 'A' }],
      ['1', { rule1: '0' }],
    ]);
    expect(settingMap.getOrDefault('1').rule1).toEqual('0');
  });

  it('returns blank when default is undefined and value is blank', () => {
    const settingMap = new SettingMap([['1', { rule1: '' }]]);
    expect(settingMap.getOrDefault('1').rule1).toEqual('');
  });
});

describe('sortMigrations', () => {
  it('sorts migrations as expected', () => {
    expect(['0.6', '1.2', '1.0'].sort(sortMigrations)).toEqual([
      '0.6',
      '1.0',
      '1.2',
    ]);
  });

  it('manages incremental versions', () => {
    expect(['0.6.1', '0.6', '1.0'].sort(sortMigrations)).toEqual([
      '0.6',
      '0.6.1',
      '1.0',
    ]);
  });

  it('works with objects', () => {
    expect(
      Object.entries({ '0.1': 'b', '0.0.1': 'a' }).sort((e1, e2) =>
        sortMigrations(e1[0], e2[0]),
      ),
    ).toEqual([
      ['0.0.1', 'a'],
      ['0.1', 'b'],
    ]);
  });
});

describe('rule sheet', () => {
  let frontend: FakeFrontend;
  const rules: Record<string, RuleExecutorClass<TestClientTypes>> = {};

  beforeEach(() => {
    const values = {
      '1': equalTo(42, 1, {}),
      '42': equalTo(42, 42, {}),
    };
    rules['ruleA'] = newRule({
      params: {},
      valueFormat: { label: 'Some Value' },
      name: 'Rule A',
      description: 'The rule for rule A',
      granularity: Granularity.DEFAULT,
      async callback() {
        return { values };
      },
    });
    rules['ruleB'] = newRule({
      params: {},
      valueFormat: { label: 'Some Value' },
      name: 'Rule B',
      description: 'The rule for rule B',
      granularity: Granularity.DEFAULT,
      async callback() {
        return { values };
      },
    });
    rules['ruleC'] = newRule({
      params: {},
      valueFormat: { label: 'Some Value' },
      name: 'No HTML',
      description: 'This <strong>is too much <em>HTML</em></strong>',
      granularity: Granularity.DEFAULT,
      async callback() {
        return { values };
      },
    });
    rules['ruleD'] = newRule({
      params: {},
      valueFormat: { label: 'Some Value' },
      name: 'Paragraphs',
      description: '<p>One line</p><p>Another line</p>',
      granularity: Granularity.DEFAULT,
      async callback() {
        return { values };
      },
    });
    mockAppsScript();
    frontend = new FakeFrontend({
      ruleRangeClass: RuleRange,
      rules: Object.values(rules),
      version: '1.0',
      clientInitializer: () => new FakeClient(),
      migrations: {},
      properties: new FakePropertyStore(),
    });
  });

  it('loads rules fresh when empty', async () => {
    await frontend.initializeRules();
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Enable/Disable Rules',
    );
    const values = sheet.getRange(1, 1, 3, 3).getValues();

    expect(values).toEqual([
      ['Rule Name', 'Description', 'Enabled'],
      ['Rule A', 'The rule for rule A', true],
      ['Rule B', 'The rule for rule B', true],
    ]);
  });

  it('strips non-paragraph HTML tags from descriptions', async () => {
    await frontend.initializeRules();
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Enable/Disable Rules',
    );
    const values = sheet.getRange(4, 2, 1, 1).getValues();

    expect(values).toEqual([['This is too much HTML']]);
  });

  it('converts paragraph HTML tags to newlines', async () => {
    await frontend.initializeRules();
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Enable/Disable Rules',
    );
    const values = sheet.getRange(5, 2, 1, 1).getValues();

    expect(values).toEqual([['One line\n\nAnother line']]);
  });

  it('returns an object of enabled / disabled rules', async () => {
    for (const rule of Object.values(rules)) {
      frontend.client.addRule(rule, [[''], ['']]);
    }
    const values = [
      ['Rule Name', 'Description', 'Enabled'],
      ['Rule A', 'The rule for rule A', true],
      ['Rule B', 'The rule for rule B', false],
      ['No HTML', 'The rule for rule A', true],
      ['Paragraphs', 'The rule for rule B', false],
    ];
    SpreadsheetApp.getActive()
      .insertSheet('Enable/Disable Rules')
      .getRange(1, 1, values.length, values[0].length)
      .setValues(values);

    const mapObject = frontend.setUpRuleSheet();

    expect(Object.fromEntries(mapObject)).toEqual({
      'Rule A': true,
      'Rule B': false,
      'No HTML': true,
      Paragraphs: false,
    });
  });

  it('has checkboxes in the correct rows', async () => {
    type Checkboxes = GoogleAppsScript.Spreadsheet.Spreadsheet & {
      checkboxes: Record<number, Record<number, boolean>>;
    };

    await frontend.initializeRules();
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Enable/Disable Rules',
    ) as unknown as Checkboxes;

    expect(sheet.getRange('A1:A5').getValues().flat(1)).toEqual([
      'Rule Name',
      'Rule A',
      'Rule B',
      'No HTML',
      'Paragraphs',
    ]);
    expect(sheet.checkboxes).toEqual({
      2: { 3: true },
      3: { 3: true },
      4: { 3: true },
      5: { 3: true },
    });
  });
});

describe('test HELPERS', () => {
  beforeEach(() => {
    mockAppsScript();
  });

  it('saveLastReportPull', () => {
    HELPERS.saveLastReportPull(1);
    expect(CacheService.getScriptCache().get('scriptPull')).toEqual('1');
    const expirationInSeconds = (
      CacheService.getScriptCache() as unknown as {
        expirationInSeconds: number | undefined;
      }
    ).expirationInSeconds;
    expect(expirationInSeconds).toBeUndefined();
  });

  it('getLastReportPull', () => {
    CacheService.getScriptCache().put('scriptPull', '10');
    expect(HELPERS.getLastReportPull()).toEqual(10);
  });
});

describe('Test emails', () => {
  let frontend: FakeFrontend;
  let rules: Record<string, RuleGetter>;

  const email = (to: string) => ({
    to,
    subject: 'Anomalies found for test',
    body: `The following errors were found:

          ----------
          Rule A:
          ----------
          - v1
          - v3

          ----------
          Rule B:
          ----------
          - v5`.replace(/  +/g, ''),
  });

  beforeEach(() => {
    setUp();
    rules = {
      keyA: {
        name: 'Rule A',
        values: {
          '1': {
            value: 'v1',
            anomalous: true,
            fields: {},
          },
          '2': {
            value: 'v2',
            anomalous: false,
            fields: {},
          },
          '3': {
            value: 'v3',
            anomalous: true,
            fields: {},
          },
        },
      },
      keyB: {
        name: 'Rule B',
        values: {
          '1': {
            value: 'v4',
            anomalous: false,
            fields: {},
          },
          '2': {
            value: 'v5',
            anomalous: true,
            fields: {},
          },
        },
      },
      keyC: {
        name: 'Rule C',
        values: {
          '1': {
            value: 'v6',
            anomalous: false,
            fields: {},
          },
          '2': {
            value: 'v7',
            anomalous: false,
            fields: {},
          },
        },
      },
    };
    frontend = new FakeFrontend({
      ruleRangeClass: RuleRange,
      rules: [],
      version: '1.0',
      clientInitializer: () => new FakeClient(),
      migrations: {},
      properties: new FakePropertyStore(),
    });
  });

  it('sends anomalies to a user whenever they are new', () => {
    SpreadsheetApp.getActive()
      .getRangeByName('EMAIL_LIST')!
      .setValue('user@example.com');
    const messageExists: boolean[] = [];

    // Act
    frontend.maybeSendEmailAlert(rules);
    // Add messages
    messageExists.push(frontend.getMessages().length === 1);
    // One anomaly is resolved.
    const newRules = getNewRules(rules, 'keyB');
    frontend.maybeSendEmailAlert(newRules);
    messageExists.push(frontend.getMessages().length === 1);
    // The anomaly is back.
    frontend.maybeSendEmailAlert(rules);
    const messages = frontend.getMessages();
    messageExists.push(messages.length === 1);
    // Expected output shows the old anomaly is freshly alerted.
    const newEmail = email('user@example.com');
    newEmail.body = `The following errors were found:

      ----------
      Rule B:
      ----------
      - v5`.replace(/  +/g, '');

    // Assert
    expect(messageExists).toEqual([true, false, true]);
    expect(messages).toEqual([newEmail]);
  });
});

describe('BigQuery interop', () => {
  beforeEach(() => {
    mockAppsScript();
  });

  it('converts a BigQuery object into the desired output', () => {
    scaffoldSheetWithNamedRanges();
    globalThis.BigQuery.Jobs.query = () => ({
      kind: 'bigquery#queryResponse',
      schema: {
        fields: [
          {
            name: 'criteria_id',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'en_name',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'canonical_name',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'parent_id',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'country_code',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'display_feature_type',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'status',
            type: 'STRING',
            mode: 'NULLABLE',
          },
        ],
      },
      jobReference: {
        projectId: 'project',
        jobId: 'job_1',
        location: 'US',
      },
      totalRows: '3',
      rows: [
        {
          f: [
            {
              v: 'ID 1' as unknown as object,
            },
            {
              v: 'English Name 1' as unknown as object,
            },
            {
              v: 'Canonical Name 1' as unknown as object,
            },
            {
              v: 'Parent ID 1' as unknown as object,
            },
            {
              v: 'Country Code 1' as unknown as object,
            },
            {
              v: 'Display Feature Type 1' as unknown as object,
            },
            {
              v: 'Status 1' as unknown as object,
            },
          ],
        },
        {
          f: [
            {
              v: 'ID 2' as unknown as object,
            },
            {
              v: 'English Name 2' as unknown as object,
            },
            {
              v: 'Canonical Name 2' as unknown as object,
            },
            {
              v: 'Parent ID 2' as unknown as object,
            },
            {
              v: 'Country Code 2' as unknown as object,
            },
            {
              v: 'Display Feature Type 2' as unknown as object,
            },
            {
              v: 'Status 2' as unknown as object,
            },
          ],
        },
        {
          f: [
            {
              v: 'ID 3' as unknown as object,
            },
            {
              v: 'English Name 3' as unknown as object,
            },
            {
              v: 'Canonical Name 3' as unknown as object,
            },
            {
              v: 'Parent ID 3' as unknown as object,
            },
            {
              v: 'Country Code 3' as unknown as object,
            },
            {
              v: 'Display Feature Type 3' as unknown as object,
            },
            {
              v: 'Status 3' as unknown as object,
            },
          ],
        },
      ],
      totalBytesProcessed: '1',
      jobComplete: true,
      cacheHit: false,
      queryId: 'job_1',
      jobCreationReason: {
        code: 'REQUESTED',
      },
    });

    const result = HELPERS.bigQueryGet('stub');

    expect(result).toEqual(
      [1, 2, 3].map((i) => ({
        criteria_id: `ID ${i}`,
        en_name: `English Name ${i}`,
        canonical_name: `Canonical Name ${i}`,
        parent_id: `Parent ID ${i}`,
        country_code: `Country Code ${i}`,
        display_feature_type: `Display Feature Type ${i}`,
        status: `Status ${i}`,
      })),
    );
  });

  it('fails with no GCP project ID set', () => {
    mockAppsScript();
    scaffoldSheetWithNamedRanges({ blanks: ['GCP_PROJECT_ID'] });
    expect(() => HELPERS.bigQueryGet('stub')).toThrowError(
      "Require a value in named range 'GCP_PROJECT_ID'",
    );
  });
});

/**
 * Replaces a current ruleset with a copy that lacks a given key.
 */
function getNewRules(rules: Record<string, RuleGetter>, keyToRemove: string) {
  const newRules = Object.assign({}, rules);
  delete newRules[keyToRemove];
  return newRules;
}

function generateTestClient(params: { id?: string }): TestClientInterface {
  return {
    id: params.id ?? '1',
    ruleStore: {},
    async getAllCampaigns() {
      return [];
    },
    validate() {
      throw new Error('Not implemented.');
    },
    addRule: <
      P extends Record<keyof P, ParamDefinition>,
    >(): TestClientInterface => {
      throw new Error('Not implemented.');
    },
    args: { label: 'test' },
    properties: new FakePropertyStore(),
  };
}

function initializeRuleRange(client: TestClientInterface) {
  return new RuleRange(
    [
      ['', '', 'Category A', '', 'Category B', '', '', 'Category C'],
      [
        'id',
        'name',
        'Header 1',
        'Header 2',
        'Header 3',
        'Header 4',
        'Header 5',
        'Header 6',
      ],
      ['1', 'one', 'Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'],
    ],
    client,
    ['id'],
  );
}
