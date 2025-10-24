import {
  FakePropertyStore,
  mockAppsScript,
} from '#common/test_helpers/mock_apps_script.js';
import { SearchAdsFrontend } from '#sa360/frontend.js';
import { ClientInterface, ReportClass, ReportInterface } from '../types.js';
import { PropertyStore, RecordInfo } from '#common/types.js';
import { Client, RuleRange } from '../client.js';
import { ageTargetRule, geoTargetRule } from '../rules.js';
import {
  CredentialManager,
  GoogleAdsApiFactory,
  ReportFactory,
  SA360_API_ENDPOINT,
} from '#common/ads_api.js';
import { Query, QueryBuilder } from '#common/ads_api_types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('initializeSheets', () => {
  let frontend: SearchAdsFrontend;

  beforeEach(async () => {
    setUp();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(1970, 0, 1)));
    frontend = getFrontend((client) => testData(client));
    await frontend.initializeRules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads blank values', () => {
    const values = SpreadsheetApp.getActive()
      .getSheetByName('Rule Settings - Campaign')
      .getRange(5, 1, 2, 3)
      .getValues();
    expect(values).toEqual([
      ['c1', 'Campaign 1', ''],
      ['c2', 'Campaign 2', ''],
    ]);
  });
});

describe('validate/launchMonitor functions', () => {
  let frontend: SearchAdsFrontend;

  beforeEach(async () => {
    setUp();
    frontend = getFrontend((client) => testData(client));
    await frontend.initializeRules();
  });

  it('runs with no errors when entity first found', async () => {
    await frontend.launchMonitor();
    expect(
      SpreadsheetApp.getActive()
        .getSheetByName('Age Target Change - Results')
        .getDataRange()
        .getValues(),
    ).toEqual([]);
  });

  it('runs with no errors', async () => {
    const range = SpreadsheetApp.getActive().getSheetByName(
      'Rule Settings - Ad Group',
    );
    const values = range.getDataRange().getValues();
    values[4][2] = '1';
    range.getDataRange().setValues(values);
    await frontend.launchMonitor();
    expect(
      SpreadsheetApp.getActive()
        .getSheetByName('Age Target Change - Results')
        .getDataRange()
        .getValues(),
    ).toEqual([]);
  });

  describe('error run', () => {
    beforeEach(async () => {
      const customFn = (o: string, rowNumber: number) => {
        if (o === 'campaignId') return `c${rowNumber + 1}`;
        if (o === 'criterionId' && rowNumber === 0) {
          return 'Nowhere';
        }
        if (rowNumber === 0) return '1';
        return '';
      };
      frontend = getFrontend((client) =>
        testData(client, { reportResult: customFn }),
      );
      await frontend.initializeRules();
      const sheet = SpreadsheetApp.getActive().getSheetByName(
        'Rule Settings - Campaign',
      );
      sheet.getRange(4, 3).setValue('Nowhere'); // Set default to Nowhere
      sheet.getRange(5, 3).setValue('1'); // Set c1 to 1
      await frontend.launchMonitor();
    });

    afterEach(() => {
      SpreadsheetApp.getActive()
        .getSheetByName('Rule Settings - Campaign')
        .clear();
    });

    it('runs with errors', () => {
      expect(
        SpreadsheetApp.getActive()
          .getSheetByName('Geo Target Change - Results')
          .getDataRange()
          .getValues(),
      ).toEqual([
        ['Change', 'anomalous', 'Customer ID', 'Customer Name', 'Campaign ID'],
        ['1 DELETED, Nowhere ADDED', 'true', '1', '1', 'c1'],
      ]);
    });

    it('has blank set safely', () => {
      expect(
        SpreadsheetApp.getActive()
          .getSheetByName('Rule Settings - Campaign')
          .getRange(3, 1, 4, 3)
          .getValues(),
      ).toEqual([
        ['ID', 'Campaign Name', 'Criteria IDs'],
        ['default', '', 'Nowhere'],
        ['c1', 'Campaign 1', '1'],
        ['c2', 'Campaign 2', ''],
      ]);
    });
  });

  it('skips disabled rules', async () => {
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
    expect(budgetPacingRuleName).toBe(ageTargetRule.name);
    expect(geoTargetRuleName).toBe(geoTargetRule.name);
    // then validate that pacing doesn't work (it's disabled).
    expect(
      SpreadsheetApp.getActive().getSheetByName(
        `${ageTargetRule.name} - Results`,
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

function scaffoldSheetWithNamedRanges() {
  for (const [i, [constName, value]] of [
    ['LOGIN_CUSTOMER_ID', '1'],
    ['CUSTOMER_IDS', '1'],
    ['EMAIL_LIST', ''],
    ['LABEL', 'Acme Inc.'],
    ['LAUNCH_MONITOR_OPTION', 'Sheets only'],
    ['FULL_FETCH', 'true'],
  ].entries()) {
    const range = SpreadsheetApp.getActive()
      .getActiveSheet()
      .getRange(`$A$${i + 1}`);
    SpreadsheetApp.getActive().setNamedRange(constName, range);
    SpreadsheetApp.getActive().getRangeByName(constName)!.setValue(value);
  }
}

describe('withIdentity', () => {
  it('constructs a frontend', () => {
    setUp();
    const frontend = SearchAdsFrontend.withIdentity({
      ruleRangeClass: RuleRange,
      rules: [],
      version: '3.0',
      clientInitializer: () => ({}) as never,
      properties: new FakePropertyStore(),
    });
    expect(frontend).toBeInstanceOf(SearchAdsFrontend);
  });
});

describe('getIdentity', () => {
  it('is called once on construction', () => {
    setUp();
    const getIdentityFieldsSpy = vi.spyOn(
      SearchAdsFrontend.prototype,
      'getIdentityFields',
    );
    getFrontend();
    expect(getIdentityFieldsSpy).toHaveBeenCalledTimes(1);
  });
});

describe('getIdentityFields', () => {
  it('returns the correct identity fields from named ranges', () => {
    setUp();
    const frontend = getFrontend();
    const spreadsheet = SpreadsheetApp.getActive();
    const sheet = spreadsheet.getActiveSheet();

    const loginCustomerIdRange = sheet.getRange('A1');
    loginCustomerIdRange.setValue('123-456-7890');
    spreadsheet.setNamedRange('LOGIN_CUSTOMER_ID', loginCustomerIdRange);

    const customerIdsRange = sheet.getRange('B1');
    customerIdsRange.setValue('987-654-3210');
    spreadsheet.setNamedRange('CUSTOMER_IDS', customerIdsRange);

    const labelRange = sheet.getRange('C1');
    labelRange.setValue('SA360 Test Label');
    spreadsheet.setNamedRange('LABEL', labelRange);

    const identityFields = frontend.getIdentityFields();

    expect(identityFields['LOGIN_CUSTOMER_ID']).toEqual({
      label: 'Login Customer ID',
      value: '123-456-7890',
    });
    expect(identityFields['CUSTOMER_IDS']).toEqual({
      label: 'Customer IDs',
      value: '987-654-3210',
    });
    expect(identityFields['LABEL']).toEqual({
      label: 'Label',
      value: 'SA360 Test Label',
    });
  });
});

function setUp() {
  mockAppsScript();
  scaffoldSheetWithNamedRanges();
}

function getFrontend(
  overrides: (client: ClientInterface) => ClientInterface = (client) => client,
  properties: PropertyStore = new FakePropertyStore(),
) {
  const apiFactory = new GoogleAdsApiFactory({
    developerToken: '',
    credentialManager: new CredentialManager(),
    apiEndpoint: SA360_API_ENDPOINT,
  });
  const api = apiFactory.create('');
  vi.spyOn(apiFactory, 'create').mockReturnValue(api);
  const reportFactory = new ReportFactory(apiFactory, {
    customerIds: '1',
    label: 'test',
  });
  return SearchAdsFrontend.withIdentity({
    ruleRangeClass: RuleRange,
    rules: [geoTargetRule, ageTargetRule],
    version: '3.0',
    clientInitializer(clientArgs, properties) {
      const client = new Client(clientArgs, properties, reportFactory);
      return overrides(client);
    },
    properties,
  });
}

function fn(o: string, rowNumber: number) {
  if (o === 'adGroupId') {
    return `ag${rowNumber + 1}`;
  }
  if (o === 'campaignId') {
    return `c${rowNumber + 1}`;
  }
  if (rowNumber === 0) {
    return '1';
  }
  return '';
}

function testData(
  client: ClientInterface,
  { numberOfCampaigns = 2, numberOfAdGroups = 2, reportResult = fn } = {
    numberOfCampaigns: 2,
    numberOfAdGroups: 2,
    reportResult: fn,
  },
) {
  const campaignArr = Array.from({ length: numberOfCampaigns });
  const adGroupArr = Array.from({ length: numberOfAdGroups });
  client.getAllCampaigns = async () => {
    return campaignArr.map((_, i) => ({
      advertiserId: '1',
      id: `c${i + 1}`,
      displayName: `Campaign ${i + 1}`,
    })) satisfies RecordInfo[];
  };

  client.getAllAdGroups = async () => {
    return adGroupArr.map((_, i) => ({
      advertiserId: '1',
      id: `ag${i + 1}`,
      displayName: `Ad Group ${i + 1}`,
    })) satisfies RecordInfo[];
  };

  client.getReport = <
    Q extends QueryBuilder<Query<P>>,
    O extends string,
    P extends string,
  >(
    reportClass: ReportClass<Q, O, P>,
  ) => {
    return {
      fetch() {
        function reportRow(rowNum: number): Record<O, string> {
          return Object.fromEntries(
            reportClass.output.map(
              (o) => [o, reportResult(o, rowNum)] satisfies [O, string],
            ),
          ) as Record<O, string>;
        }
        return Object.fromEntries(
          campaignArr.map((_, i) => [`ag${i}`, reportRow(i)]),
        );
      },
      transform() {
        return [
          '',
          Object.fromEntries(
            reportClass.output.map((o) => [o as O, '1']),
          ) as unknown as Record<O, string>,
        ];
      },
    } satisfies ReportInterface<Q, O, P>;
  };
  return client;
}
