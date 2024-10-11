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
  tearDownStubs,
  TestClientInterface,
  TestClientTypes,
} from './helpers';
import { equalTo } from 'common/checks';
import * as sinon from 'sinon';
import { expect } from 'chai';

function setUp() {
  mockAppsScript();
  const insertRows = sinon
    .stub(HELPERS, 'insertRows')
    .callsFake((range) => range);
  return { stubs: [insertRows] };
}

describe('Test migration order', function () {
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

  beforeEach(function () {
    mockAppsScript();
  });

  afterEach(function () {
    list.splice(0, list.length);
  });

  it('migrates all', function () {
    const frontend = setFrontend({
      expectedVersion: '5.0',
      currentVersion: '1.0',
    });
    frontend.migrate();
    expect(list).to.deep.eq(['2.0', '2.1.0', '2.1.4', '2.2.0', '3.0']);
  });

  it('partially migrates', function () {
    const frontend = setFrontend({
      expectedVersion: '5.0',
      currentVersion: '2.1.0',
    });
    frontend.migrate();
    expect(list).to.deep.eq(['2.1.4', '2.2.0', '3.0']);
  });

  it('runs when initializeSheets runs', async function () {
    const frontend = setFrontend({
      expectedVersion: CURRENT_SHEET_VERSION,
      currentVersion: '1.0',
    });
    mockAppsScript();
    sinon.stub(HtmlService, 'createTemplateFromFile');
    PropertiesService.getScriptProperties().setProperty('sheet_version', '0.1');
    await frontend.initializeSheets();
    expect(
      PropertiesService.getScriptProperties().getProperty('sheet_version'),
    ).to.equal(String(CURRENT_SHEET_VERSION));
  });

  it('does not run migrations if version is up-to-date', function () {
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
    expect(numberRun).to.equal(0);
  });

  it('migrates only to specified version cap', function () {
    const frontend = setFrontend({
      expectedVersion: '2.1.0',
      currentVersion: '2.1.0',
    });
    const numberOfMigrations = frontend.migrate();
    expect(list).to.deep.eq([]);
    expect(numberOfMigrations).to.equal(0);
  });
});

describe('2-D array', function () {
  let array2d: string[][];
  const params = { rule1: { label: 'Rule 1' }, rule2: { label: 'Rule 2' } };

  beforeEach(function () {
    array2d = [
      ['', 'Rule 1', 'Rule 2'],
      ['1', 'A', 'B'],
      ['2', 'C', 'D'],
    ];
  });

  it('transforms into a param', function () {
    expect(transformToParamValues(array2d, params)).to.deep.eq(
      new SettingMap([
        ['1', { rule1: 'A', rule2: 'B' }],
        ['2', { rule1: 'C', rule2: 'D' }],
      ]),
    );
  });

  it('triggers an error if empty', function () {
    const error = new Error(
      'Expected a grid with row and column headers of at least size 2',
    );
    expect(() => transformToParamValues([], params)).to.throw(error.message);
    expect(() => transformToParamValues([[]], params)).to.throw(error.message);
    expect(() => transformToParamValues([['']], params)).to.throw(
      error.message,
    );
  });
});

describe('Rule Settings helper functions', function () {
  let rules: RuleRange;

  beforeEach(function () {
    const client = generateTestClient({ id: '1' });
    rules = initializeRuleRange(client);
    for (const rule of ['', 'Category A', 'Category B', 'Category C']) {
      // getValues() expects a rule to be in the ruleStore for the helper value.
      client.ruleStore[rule] = {
        helper: '',
        granularity: 'default',
      } as unknown as (typeof client.ruleStore)[keyof typeof client.ruleStore];
    }
  });

  it('break down a settings sheet into the correct categories', function () {
    expect(
      (
        rules as unknown as {
          rules: Record<string, Array<string[] | undefined>>;
        }
      ).rules,
    ).to.deep.eq({
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

  it('combines categories back into a settings sheet', function () {
    expect(rules.getRule('Category A')).to.deep.eq([
      ['id', 'Header 1', 'Header 2'],
      ['1', 'Col 1', 'Col 2'],
    ]);
  });

  it('writes back to the spreadsheet - base case', function () {
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
    expect(range.getValues()).to.deep.equal(expected);
  });

  it('writes back to the spreadsheet - cares about changes', function () {
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

    expect(range.getValues()).to.deep.eq([
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

describe('SettingMap#getOrDefault', function () {
  it('returns value', function () {
    const settingMap = new SettingMap([
      ['default', { rule1: 'A' }],
      ['1', { rule1: 'C' }],
    ]);
    expect(settingMap.getOrDefault('1').rule1).to.equal('C');
  });

  it('returns defaults when value is blank', function () {
    const settingMap = new SettingMap([
      ['default', { rule1: 'A' }],
      ['1', { rule1: '' }],
    ]);
    expect(settingMap.getOrDefault('1').rule1).to.equal('A');
  });

  it('returns value when value is 0', function () {
    const settingMap = new SettingMap([
      ['default', { rule1: 'A' }],
      ['1', { rule1: '0' }],
    ]);
    expect(settingMap.getOrDefault('1').rule1).to.equal('0');
  });

  it('returns blank when default is undefined and value is blank', function () {
    const settingMap = new SettingMap([['1', { rule1: '' }]]);
    expect(settingMap.getOrDefault('1').rule1).to.equal('');
  });
});

describe('sortMigrations', function () {
  it('sorts migrations as expected', function () {
    expect(['0.6', '1.2', '1.0'].sort(sortMigrations)).to.deep.eq([
      '0.6',
      '1.0',
      '1.2',
    ]);
  });

  it('manages incremental versions', function () {
    expect(['0.6.1', '0.6', '1.0'].sort(sortMigrations)).to.deep.eq([
      '0.6',
      '0.6.1',
      '1.0',
    ]);
  });

  it('works with objects', function () {
    expect(
      Object.entries({ '0.1': 'b', '0.0.1': 'a' }).sort((e1, e2) =>
        sortMigrations(e1[0], e2[0]),
      ),
    ).to.deep.eq([
      ['0.0.1', 'a'],
      ['0.1', 'b'],
    ]);
  });
});

describe('rule sheet', function () {
  let frontend: FakeFrontend;
  const rules: Record<string, RuleExecutorClass<TestClientTypes>> = {};

  beforeEach(function () {
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

  it('loads rules fresh when empty', async function () {
    await frontend.initializeRules();
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Enable/Disable Rules',
    );
    const values = sheet.getRange(1, 1, 3, 3).getValues();

    expect(values).to.deep.eq([
      ['Rule Name', 'Description', 'Enabled'],
      ['Rule A', 'The rule for rule A', true],
      ['Rule B', 'The rule for rule B', true],
    ]);
  });

  it('strips non-paragraph HTML tags from descriptions', async function () {
    await frontend.initializeRules();
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Enable/Disable Rules',
    );
    const values = sheet.getRange(4, 2, 1, 1).getValues();

    expect(values).to.deep.eq([['This is too much HTML']]);
  });

  it('converts paragraph HTML tags to newlines', async function () {
    await frontend.initializeRules();
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Enable/Disable Rules',
    );
    const values = sheet.getRange(5, 2, 1, 1).getValues();

    expect(values).to.deep.eq([['One line\n\nAnother line']]);
  });

  it('returns an object of enabled / disabled rules', async function () {
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

    expect(Object.fromEntries(mapObject)).to.deep.eq({
      'Rule A': true,
      'Rule B': false,
      'No HTML': true,
      Paragraphs: false,
    });
  });

  it('has checkboxes in the correct rows', async function () {
    type Checkboxes = GoogleAppsScript.Spreadsheet.Spreadsheet & {
      checkboxes: Record<number, Record<number, boolean>>;
    };

    await frontend.initializeRules();
    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Enable/Disable Rules',
    ) as unknown as Checkboxes;

    expect(sheet.getRange('A1:A5').getValues().flat(1)).to.deep.eq([
      'Rule Name',
      'Rule A',
      'Rule B',
      'No HTML',
      'Paragraphs',
    ]);
    expect(sheet.checkboxes).to.deep.eq({
      2: { 3: true },
      3: { 3: true },
      4: { 3: true },
      5: { 3: true },
    });
  });
});

describe('test HELPERS', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  it('saveLastReportPull', function () {
    HELPERS.saveLastReportPull(1);
    expect(CacheService.getScriptCache().get('scriptPull')).to.equal('1');
    const expirationInSeconds = (
      CacheService.getScriptCache() as unknown as {
        expirationInSeconds: number | undefined;
      }
    ).expirationInSeconds;
    expect(expirationInSeconds).to.be.undefined;
  });

  it('getLastReportPull', function () {
    CacheService.getScriptCache().put('scriptPull', '10');
    expect(HELPERS.getLastReportPull()).to.equal(10);
  });
});

describe('Test emails', function () {
  let frontend: FakeFrontend;
  let rules: Record<string, RuleGetter>;
  let stubs: sinon.SinonStub[];

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

  beforeEach(function () {
    ({ stubs } = setUp());
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

  afterEach(function () {
    tearDownStubs(stubs);
  });

  it('sends anomalies to a user whenever they are new', function () {
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
    expect(messageExists).to.deep.eq([true, false, true]);
    expect(messages).to.deep.eq([newEmail]);
  });
});

describe('BigQuery interop', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  it('converts a BigQuery object into the desired output', function () {
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

    expect(result).to.deep.eq(
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

  it('fails with no GCP project ID set', function () {
    mockAppsScript();
    scaffoldSheetWithNamedRanges({ blanks: ['GCP_PROJECT_ID'] });
    expect(() => HELPERS.bigQueryGet('stub')).to.throw(
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
