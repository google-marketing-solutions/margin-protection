/**
 * @fileoverview Tests the Apps Script main functions.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { TARGETING_TYPE } from 'dv360_api/dv360_types.js';
import { equalTo } from '#common/checks.js';
import { HELPERS } from '#common/sheet_helpers/index.js';
import {
  FakeHtmlOutput,
  FakePropertyStore,
  mockAppsScript,
} from '#common/test_helpers/mock_apps_script.js';
import { PropertyStore } from '#common/types.js';

import { Client, RuleRange } from '../client.js';
import { DisplayVideoFrontend } from '../frontend.js';
import {
  budgetPacingPercentageRule,
  budgetPacingRuleLineItem,
  geoTargetRule,
} from '../rules.js';
import { ClientArgs, ClientInterface, IDType } from '../types.js';

import {
  AdvertiserTemplateConverter,
  CampaignTemplateConverter,
  generateTestClient,
  InsertionOrderTemplateConverter,
  LineItemTemplateConverter,
} from './client_helpers.js';

import { AssignedTargetingOption } from 'dv360_api/dv360_resources.js';

type HtmlTemplate = GoogleAppsScript.HTML.HtmlTemplate;

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
    vi.useFakeTimers({
      now: new Date('1970-03-01'),
      shouldAdvanceTime: true,
    });
    testData({});
    await rules.fillRuleValues(geoTargetRule.definition);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

describe('validate/launchMonitor functions', () => {
  let frontend: DisplayVideoFrontend;

  beforeEach(async () => {
    vi.useFakeTimers({
      now: new Date(Date.UTC(1970, 0, 1)),
      shouldAdvanceTime: false,
    });
    const allCampaigns: Record<string, CampaignTemplateConverter[]> = {
      '1': [
        (campaign) => {
          campaign.id = 'c1';
          campaign.displayName = "Campaign 1';";
          return campaign;
        },
      ],
    };
    const allInsertionOrders: Record<
      string,
      InsertionOrderTemplateConverter[]
    > = {
      c1: [
        (insertionOrder) => {
          insertionOrder.campaignId = 'c1';
          return insertionOrder;
        },
      ],
    };
    setUp();
    frontend = getFrontend(() =>
      testData({ allCampaigns, allInsertionOrders }),
    );
    HtmlService.createTemplateFromFile = () =>
      ({ evaluate: () => new FakeHtmlOutput() }) as unknown as HtmlTemplate;
    await frontend.initializeRules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs with no errors', async () => {
    await frontend.launchMonitor();
    expect(
      SpreadsheetApp.getActive()
        .getSheetByName('Budget Pacing by Percent Ahead - Results')
        .getDataRange()
        .getValues(),
    ).toEqual([]);
  });

  it('runs with errors', async () => {
    scaffoldSheetWithNamedRanges();
    SpreadsheetApp.getActive()
      .getSheetByName('Rule Settings - Campaign')
      .getRange(4, 3)
      .setValue('Nowhere');
    await frontend.launchMonitor();

    expect(
      SpreadsheetApp.getActive()
        .getSheetByName('Geo Targeting - Results')
        .getDataRange()
        .getValues(),
    ).toEqual([
      [
        'Result',
        'anomalous',
        'Advertiser ID',
        'Campaign Name',
        'Campaign ID',
        'Number of Geos',
      ],
      [
        '"United States" not an allowed target',
        'true',
        '1',
        'Campaign 1',
        'c1',
        '1',
      ],
    ]);
  });

  it('skips disabled rules', async () => {
    console.log('en');
    scaffoldSheetWithNamedRanges();
    SpreadsheetApp.getActive()
      .getSheetByName('Rule Settings - Campaign')
      .getRange(4, 2)
      .setValue('Nowhere');
    await frontend.initializeRules();
    const range = SpreadsheetApp.getActive()
      .getSheetByName('Enable/Disable Rules')
      .getDataRange();
    const currentSettings = range.getValues();
    const geoTargetRuleName = currentSettings[1][0];
    const budgetPacingRuleName = currentSettings[2][0];

    currentSettings[1][2] = false; // geotargets
    currentSettings[2][2] = true; // pacing
    range.setValues(currentSettings);
    await frontend.launchMonitor();

    // first perform sanity checks
    expect(budgetPacingRuleName).toEqual(budgetPacingPercentageRule.name);
    expect(geoTargetRuleName).toEqual(geoTargetRule.name);
    // then validate that pacing doesn't work (it's disabled).
    expect(
      SpreadsheetApp.getActive().getSheetByName(
        `${budgetPacingPercentageRule.name} - Results`,
      ),
    ).toBeDefined();
    expect(
      SpreadsheetApp.getActive()
        .getSheetByName(`${geoTargetRule.name} - Results`)
        .getDataRange()
        .getValues(),
    ).toEqual([]);
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
    vi.useFakeTimers({ now: new Date(Date.UTC(1970, 0, 1)) });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    expect(sheet.getDataRange().getValues()).toHaveLength(3);
    expect(sheet.getDataRange().getValues()[2]).toEqual([
      'Geo Targeting',
      'Advertiser ID: 1, Campaign Name: Campaign 1, Campaign ID: c1, Number of Geos: 1',
      'OK',
      'false',
    ]);
  });

  it('ignores disabled rules', async () => {
    const noise = Array.from<string>({ length: 10 })
      .fill('')
      .map(() => Array.from<string>({ length: 10 }).fill('lorem ipsum'));

    const values = [
      ['Rule Name', 'Description', 'Enabled'],
      ['Geo Targeting', '', false],
    ];
    HELPERS.getOrCreateSheet('Enable/Disable Rules')
      .getRange(1, 1, values.length, values[0].length)
      .setValues(values);
    await frontend.preLaunchQa();

    const sheet = SpreadsheetApp.getActive().getSheetByName(
      'Pre-Launch QA Results',
    )!;
    sheet.getRange(1, 1, noise.length, noise[0].length).setValues(noise);
    // try again
    await frontend.preLaunchQa();

    expect(sheet.getDataRange().getValues()).toHaveLength(2);
  });
});

function getFrontend(
  overrides: (client: ClientInterface) => ClientInterface = (client) => client,
  properties: PropertyStore = new FakePropertyStore(),
) {
  return new DisplayVideoFrontend({
    ruleRangeClass: RuleRange,
    rules: [
      geoTargetRule,
      budgetPacingPercentageRule,
      budgetPacingRuleLineItem,
    ],
    version: '3.0',
    clientInitializer(clientArgs, properties) {
      const client = new Client(clientArgs, properties);
      return overrides(client);
    },
    properties,
  });
}

function testData(params: {
  allAdvertisers?: Record<string, AdvertiserTemplateConverter[]>;
  allInsertionOrders?: Record<string, InsertionOrderTemplateConverter[]>;
  allLineItems?: Record<string, LineItemTemplateConverter[]>;
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
            {
              displayName: geoTarget,
            },
          ),
      ),
    },
  };

  (params.allCampaigns ??= {})['1'] = [(campaign) => campaign];
  (params.allInsertionOrders ??= {})['1'] = [(io) => io];
  (params.allLineItems ??= {})['1'] = [(li) => li];
  (params.allAdvertisers ??= {})['1'] = [(advertiser) => advertiser];

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

describe('getMatrixOfResults', () => {
  let frontend: DisplayVideoFrontend;

  beforeEach(() => {
    setUp();
    frontend = getFrontend();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    vi.useFakeTimers({ now: new Date('January 1, 1970 00:00:00 GMT') });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    setUp({ level: 'Partner' });
    const allAdvertisers: Record<string, AdvertiserTemplateConverter[]> = {
      a1: [
        (advertiser) => {
          advertiser.id = 'a1';
          advertiser.displayName = 'Advertiser 1';

          return advertiser;
        },
      ],
      a2: [
        (advertiser) => {
          advertiser.id = 'a2';
          advertiser.displayName = 'Advertiser 2';

          return advertiser;
        },
      ],
      a3: [
        (advertiser) => {
          advertiser.id = 'a3';
          advertiser.displayName = 'Advertiser 3';

          return advertiser;
        },
      ],
    };
    const allCampaigns: Record<string, CampaignTemplateConverter[]> = {
      a1: [
        (campaignTemplate) => {
          campaignTemplate.id = 'c1';
          campaignTemplate.displayName = 'Campaign 1';
          campaignTemplate.advertiserId = 'a1';

          return campaignTemplate;
        },
      ],
      a2: [
        (campaignTemplate) => {
          campaignTemplate.id = 'c2';
          campaignTemplate.displayName = 'Campaign 2';
          campaignTemplate.advertiserId = 'a2';

          return campaignTemplate;
        },
      ],
      a3: [
        (campaignTemplate) => {
          campaignTemplate.id = 'c3';
          campaignTemplate.displayName = 'Campaign 3';
          campaignTemplate.advertiserId = 'a2';

          return campaignTemplate;
        },
      ],
    };
    const allInsertionOrders: Record<
      string,
      InsertionOrderTemplateConverter[]
    > = {
      a1: [
        (insertionOrderTemplate) => {
          insertionOrderTemplate.id = 'io1';
          insertionOrderTemplate.displayName = 'Insertion Order 1';
          insertionOrderTemplate.campaignId = 'c1';
          insertionOrderTemplate.advertiserId = 'a1';
          return insertionOrderTemplate;
        },
      ],
      a2: [
        (insertionOrderTemplate) => {
          insertionOrderTemplate.id = 'io2';
          insertionOrderTemplate.displayName = 'Insertion Order 2';
          insertionOrderTemplate.campaignId = 'c2';
          insertionOrderTemplate.advertiserId = 'a2';
          return insertionOrderTemplate;
        },
      ],
    };
    const allLineItems: Record<string, LineItemTemplateConverter[]> = {
      a1: [
        (lineItemTemplate) => {
          lineItemTemplate.id = 'li1';
          lineItemTemplate.displayName = 'Line Item 1';
          lineItemTemplate.campaignId = 'c1';
          lineItemTemplate.advertiserId = 'a1';
          return lineItemTemplate;
        },
      ],
      a2: [
        (lineItemTemplate) => {
          lineItemTemplate.id = 'li2';
          lineItemTemplate.displayName = 'Line Item 2';
          lineItemTemplate.campaignId = 'c2';
          lineItemTemplate.advertiserId = 'a2';
          return lineItemTemplate;
        },
      ],
      a3: [
        (insertlinOrderTemplate) => {
          insertlinOrderTemplate.id = 'li2';
          insertlinOrderTemplate.displayName = 'Line Item 2';
          insertlinOrderTemplate.campaignId = 'c2';
          insertlinOrderTemplate.advertiserId = 'a2';
          return insertlinOrderTemplate;
        },
      ],
    };
    frontend = getFrontend(() =>
      testData({
        allCampaigns,
        allAdvertisers,
        allInsertionOrders,
        allLineItems,
        idType: IDType.PARTNER,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializeRules includes advertiser ID and name in settings', () => {
    it('Insertion Order', async () => {
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
      expect(values.slice(4, 6).map((r) => r.slice(0, 4))).toEqual([
        ['io1', 'Insertion Order 1', 'a1', 'Advertiser 1'],
        ['io2', 'Insertion Order 2', 'a2', 'Advertiser 2'],
      ]);
    });

    it('Line Item', async () => {
      await frontend.initializeRules();
      const values = SpreadsheetApp.getActive()
        .getSheetByName('Rule Settings - Line Item')
        .getDataRange()
        .getValues();
      expect(values[2].slice(0, 4)).toEqual([
        'ID',
        'Line Item Name',
        'Advertiser ID',
        'Advertiser Name',
      ]);
      expect(values.slice(4, 6).map((r) => r.slice(0, 4))).toEqual([
        ['li1', 'Line Item 1', 'a1', 'Advertiser 1'],
        ['li2', 'Line Item 2', 'a2', 'Advertiser 2'],
      ]);
    });
  });
});

describe('initializeRules', () => {
  const allCampaigns: { [advertiserId: string]: CampaignTemplateConverter[] } =
    {};
  let frontend: DisplayVideoFrontend;

  beforeAll(() => {
    vi.useFakeTimers({ now: new Date('1970-03-01') });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    setUp();
    frontend = getFrontend(() => testData({ allCampaigns }));
    await frontend.initializeRules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a settings page', () => {
    const sheet = HELPERS.getOrCreateSheet('Rule Settings - Insertion Order');
    expect(sheet).toBeDefined();
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
  vi.spyOn(HELPERS, 'insertRows').mockImplementation((range) => range);
  vi.spyOn(HELPERS, 'getSheetId').mockReturnValue('id1');
  return { frontend };
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
    ['LAUNCH_MONITOR_OPTION', 'Sheets only'],
    ['EXPORT_SETTINGS', 'drive'],
  ].entries()) {
    const range = SpreadsheetApp.getActive()
      .getActiveSheet()
      .getRange(`$A$${i + 1}`);
    SpreadsheetApp.getActive().setNamedRange(constName, range);
    SpreadsheetApp.getActive().getRangeByName(constName)!.setValue(value);
  }
}
