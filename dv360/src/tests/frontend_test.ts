/**
 * @fileoverview Tests the Apps Script main functions.
 */

// g3-format-prettier

import { TARGETING_TYPE } from 'dv360_api/dv360_types';
import { equalTo } from 'common/checks';
import {
  getOrCreateSheet,
  HELPERS,
  RULE_SETTINGS_SHEET,
} from 'common/sheet_helpers';
import {
  FakeHtmlOutput,
  FakePropertyStore,
  mockAppsScript,
} from 'common/test_helpers/mock_apps_script';
import { PropertyStore } from 'common/types';

import { Client, RuleRange } from '../client';
import { DisplayVideoFrontend, migrations } from '../frontend';
import { budgetPacingPercentageRule, geoTargetRule } from '../rules';
import { ClientArgs, ClientInterface, IDType } from '../types';

import {
  AdvertiserTemplateConverter,
  CampaignTemplateConverter,
  generateTestClient,
  InsertionOrderTemplateConverter,
} from './client_helpers';

import HtmlTemplate = GoogleAppsScript.HTML.HtmlTemplate;
import { AssignedTargetingOption } from 'dv360_api/dv360_resources';

const FOLDER = 'application/vnd.google-apps.folder';

describe('Rule value filling', () => {
  let client: Client;
  let rules: RuleRange;

  const allCampaigns: Record<string, CampaignTemplateConverter[]> = {};
  const allInsertionOrders: Record<string, InsertionOrderTemplateConverter[]> =
    {};

  beforeEach(async () => {
    client = testData({ allCampaigns, allInsertionOrders });

    setUp();

    rules = new RuleRange([[]], client);
    jasmine.clock().install().mockDate(new Date('1970-03-01'));
    testData({});
    await rules.fillRuleValues(geoTargetRule.definition);
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
      [
        'ID',
        'Allowed Geo Targets',
        'Required Geo Targets',
        'Excluded Geo Targets',
      ],
      ['default', '', 'New Jersey', ''],
      ['c1', 'United States', '', ''],
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

    (client as unknown as { storedCampaigns: [] }).storedCampaigns = [];
    (client as unknown as { storedInsertionOrders: [] }).storedInsertionOrders =
      [];

    await rules.fillRuleValues(geoTargetRule.definition);
    expect(rules.getRule(geoTargetRule.definition.name)).toEqual([
      [
        'ID',
        'Allowed Geo Targets',
        'Required Geo Targets',
        'Excluded Geo Targets',
      ],
      ['default', '', 'New Jersey', ''],
      ['c1', 'United States', '', ''],
      ['c2', '', '', ''],
    ]);
  });
});

describe('Pre-Launch QA menu option', () => {
  let frontend: DisplayVideoFrontend;

  beforeEach(async () => {
    setUp();
    frontend = getFrontend(() => testData({}));
    HtmlService.createTemplateFromFile = () =>
      ({ evaluate: () => new FakeHtmlOutput() }) as unknown as HtmlTemplate;
    // force private methods to be visible, so we can manipulate them.
    await frontend.initializeRules();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(Date.UTC(1970, 0, 1)));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('clears check results that were previously set', async () => {
    const noise = Array.from<string>({ length: 10 })
      .fill('')
      .map(() => Array.from<string>({ length: 10 }).fill('lorem ipsum'));
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
      'OK',
      'false',
    ]);
  });
});

function getFrontend(
  overrides: (client: ClientInterface) => ClientInterface = (client) => client,
  properties: PropertyStore = new FakePropertyStore(),
) {
  return new DisplayVideoFrontend({
    ruleRangeClass: RuleRange,
    rules: [geoTargetRule, budgetPacingPercentageRule],
    version: '3.0',
    clientInitializer(clientArgs, properties) {
      const client = new Client(clientArgs, properties);
      return overrides(client);
    },
    migrations,
    properties,
  });
}

function testData(params: {
  allAdvertisers?: AdvertiserTemplateConverter[];
  allInsertionOrders?: Record<string, InsertionOrderTemplateConverter[]>;
  allCampaigns?: Record<string, CampaignTemplateConverter[]>;
  fakeImpressionAmount?: number;
  fakeSpendAmount?: number;
  idType?: IDType;
}) {
  const id = '1';
  const allAssignedTargetingOptions = {
    [id]: {
      ['c1']: ['United States'].map(
        (geoTarget) =>
          new AssignedTargetingOption(
            'geo1',
            TARGETING_TYPE.GEO_REGION,
            '',
            '',
            { displayName: geoTarget },
          ),
      ),
    },
  };

  (params.allCampaigns ??= {})['1'] = [(campaign) => campaign];
  (params.allInsertionOrders ??= {})['1'] = [(io) => io];
  (params.allAdvertisers ??= []).push((advertiser) => advertiser);

  params.fakeSpendAmount ??= 1000000;

  const clientArgs = {
    id,
    idType: params.idType ? params.idType : IDType.ADVERTISER,
    label: 'Test',
  } satisfies ClientArgs;

  return generateTestClient({
    id,
    allAssignedTargetingOptions,
    clientArgs,
    ...params,
  });
}

describe('Matrix to CSV', () => {
  let frontend: DisplayVideoFrontend;

  beforeEach(() => {
    setUp();
    frontend = getFrontend();
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
        currentTime: '2020-01-01T00:00:00.000Z',
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
  list(): { items?: GoogleAppsScript.Drive.Schema.File[] };
  list({ q }: { q?: string }): { items?: GoogleAppsScript.Drive.Schema.File[] };
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
  list({ q }: { q?: string } = {}) {
    if (!q) {
      return { items: undefined };
    }
    const title: string | null = (q.match(/title="([^"]+)"/) || [])[1];
    return { items: this.folders[title] };
  },
  insert(schema: GoogleAppsScript.Drive.Schema.File) {
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
  let frontend: DisplayVideoFrontend;
  let oldDrive: GoogleAppsScript.Drive;

  beforeEach(() => {
    setUp();
    frontend = getFrontend();
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
    console.log(Utilities);
    frontend.exportAsCsv('my check', [['it works!']]);
    const folderId = fakeFiles.files['reports'];
    expect(fakeFiles.folders[folderId.id!]).toEqual([
      jasmine.objectContaining({
        id: '2',
        mimeType: 'text/plain',
        parents: [{ id: '1' }],
      }),
    ]);

    for (const value of [
      'Acme Inc.',
      'my check',
      '1970-01-01T00:00:00.000Z.csv',
    ]) {
      expect(Object.keys(fakeFiles.files)[1].split('_')).toContain(value);
    }
  });
});

describe('Fill check values', () => {
  let rules: RuleRange;
  let frontend: DisplayVideoFrontend;

  beforeEach(async () => {
    setUp();
    frontend = getFrontend(() => testData({}));
    rules = new RuleRange([[]], frontend.client);
    await frontend.initializeRules();
  });
  it('removes extra fields', async () => {
    const noise = Array.from<string>({ length: 10 })
      .fill('')
      .map(() => Array.from<string>({ length: 10 }).fill('lorem ipsum'));
    const sheet = getOrCreateSheet(RULE_SETTINGS_SHEET + ' - Insertion Order')!;
    sheet.clear();
    sheet.getRange(1, 1, noise.length, noise[0].length).setValues(noise);
    await rules.fillRuleValues(geoTargetRule.definition);
    expect((await rules.getValues())[0].length).toEqual(5);
  });
});

describe('getMatrixOfResults', () => {
  let frontend: DisplayVideoFrontend;

  beforeEach(() => {
    setUp();
    frontend = getFrontend();
  });

  it('Provides 2-d array from a set of values with no fields.', async () => {
    const result = frontend.getMatrixOfResults('value1', [equalTo(1, 1, {})]);
    expect(result).toEqual([
      ['value1', 'anomalous'],
      ['1', 'false'],
    ]);
  });
  it('Provides 2-d array from a set of values with fields.', async () => {
    const result = frontend.getMatrixOfResults('value2', [
      equalTo(1, 1, { test1: 'a', test2: 'b' }),
    ]);
    expect(result).toEqual([
      ['value2', 'anomalous', 'test1', 'test2'],
      ['1', 'false', 'a', 'b'],
    ]);
  });
});

describe('Partner view', () => {
  let frontend: DisplayVideoFrontend;

  beforeAll(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('January 1, 1970 00:00:00 GMT'));
  });

  afterAll(() => {
    jasmine.clock().uninstall();
  });

  beforeEach(async () => {
    setUp({ level: 'Partner' });
    const allAdvertisers: AdvertiserTemplateConverter[] = [
      (advertiser) => {
        advertiser.id = 'a1';
        advertiser.displayName = 'Advertiser 1';

        return advertiser;
      },
    ];
    const allCampaigns: Record<string, CampaignTemplateConverter[]> = {
      '1': [
        (campaignTemplate) => {
          campaignTemplate.id = 'c2';
          campaignTemplate.displayName = 'Campaign 2';

          return campaignTemplate;
        },
      ],
    };
    const allInsertionOrders: Record<
      string,
      InsertionOrderTemplateConverter[]
    > = {
      c2: [
        (insertionOrderTemplate) => {
          insertionOrderTemplate.id = 'io2';
          insertionOrderTemplate.displayName = 'IO 2';
          insertionOrderTemplate.campaignId = 'c2';
          return insertionOrderTemplate;
        },
      ],
    };
    frontend = getFrontend(() =>
      testData({
        allCampaigns,
        allAdvertisers,
        allInsertionOrders,
        idType: IDType.PARTNER,
      }),
    );
  });

  it('Has advertiser ID and name in settings', async () => {
    await frontend.initializeRules();
    const values = SpreadsheetApp.getActive()
      .getSheetByName('Rule Settings - Insertion Order')
      .getDataRange()
      .getValues();
    expect(values[2].slice(0, 4)).toEqual([
      'ID',
      'Insertion Order Name',
      'Advertiser ID',
      'Advertiser Name',
    ]);
    expect(values[4].slice(0, 4)).toEqual([
      'io1',
      'Insertion Order 1',
      'a1',
      'Advertiser 1',
    ]);
  });
});

describe('initializeRules', () => {
  const allCampaigns: { [advertiserId: string]: CampaignTemplateConverter[] } =
    {};
  let frontend: DisplayVideoFrontend;

  beforeEach(async () => {
    setUp();
    frontend = getFrontend(() => testData({ allCampaigns }));
    jasmine.clock().install().mockDate(new Date('1970-03-01'));
    await frontend.initializeRules();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('creates a settings page', () => {
    const sheet = getOrCreateSheet('Rule Settings - Insertion Order');
    expect(sheet).toBeTruthy();
  });
});

function setUp(
  { level }: { level: 'Advertiser' | 'Partner' } = {
    level: 'Advertiser',
  },
) {
  mockAppsScript();
  PropertiesService.getScriptProperties().setProperty('sheet_version', '5.0');
  scaffoldSheetWithNamedRanges({ level });
  const frontend = getFrontend(() => testData({ idType: IDType.PARTNER }));
  spyOn(HELPERS, 'insertRows').and.callFake((range) => range);
  spyOn(HELPERS, 'getSheetId').and.callFake(() => 'id1');
  return frontend;
}

function scaffoldSheetWithNamedRanges(
  { level }: { level: 'Advertiser' | 'Partner' } = {
    level: 'Advertiser',
  },
) {
  for (const [i, [constName, value]] of [
    ['ENTITY_ID', '1'],
    ['ID_TYPE', level],
    ['EMAIL_LIST', ''],
    ['LABEL', 'Acme Inc.'],
  ].entries()) {
    const range = SpreadsheetApp.getActive()
      .getActiveSheet()
      .getRange(`$A$${i + 1}`);
    SpreadsheetApp.getActive().setNamedRange(constName, range);
    SpreadsheetApp.getActive().getRangeByName(constName)!.setValue(value);
  }
}
