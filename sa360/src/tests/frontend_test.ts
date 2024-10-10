import {
  FakePropertyStore,
  mockAppsScript,
} from 'common/test_helpers/mock_apps_script';
import { SearchAdsFrontend } from 'sa360/src/frontend';
import { ClientInterface, ReportClass, ReportInterface } from '../types';
import { PropertyStore, RecordInfo } from 'common/types';
import { Client, RuleRange } from '../client';
import { ageTargetRule, geoTargetRule } from '../rules';
import {
  CredentialManager,
  GoogleAdsApiFactory,
  ReportFactory,
  SA360_API_ENDPOINT,
} from 'common/ads_api';
import { Query, QueryBuilder } from 'common/ads_api_types';
import { expect } from 'chai';
import * as sinon from 'sinon';

describe('End-to-end SA360 tests', function () {
  describe('initializeSheets', function () {
    let frontend: SearchAdsFrontend;
    let timer: sinon.SinonFakeTimers;

    beforeEach(async function () {
      setUp();
      timer = sinon.useFakeTimers(new Date(Date.UTC(1970, 0, 1)));
      frontend = getFrontend((client) => testData(client));
      await frontend.initializeRules();
    });

    afterEach(function () {
      timer.restore();
    });

    it('loads blank values', function () {
      const values = SpreadsheetApp.getActive()
        .getSheetByName('Rule Settings - Campaign')
        .getRange(5, 1, 2, 3)
        .getValues();
      expect(values).to.eql([
        ['c1', 'Campaign 1', ''],
        ['c2', 'Campaign 2', ''],
      ]);
    });
  });

  describe('validate/launchMonitor functions', function () {
    let frontend: SearchAdsFrontend;
    let timer: sinon.SinonFakeTimers;

    beforeEach(async function () {
      setUp();
      timer = sinon.useFakeTimers(new Date(Date.UTC(1970, 0, 1)));
      frontend = getFrontend((client) => testData(client));
      await frontend.initializeRules();
    });

    it('runs with no errors when entity first found', async function () {
      await frontend.launchMonitor();
      expect(
        SpreadsheetApp.getActive()
          .getSheetByName('Age Target Change - Results')
          .getDataRange()
          .getValues(),
      ).to.eql([]);
    });

    it('runs with no errors', async function () {
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
      ).to.eql([]);
    });

    describe('error run', function () {
      beforeEach(async function () {
        await frontend.initializeRules();
        SpreadsheetApp.getActive()
          .getSheetByName('Rule Settings - Campaign')
          .getRange(4, 2)
          .setValue('Nowhere');
        await frontend.launchMonitor();
      });

      afterEach(function () {
        SpreadsheetApp.getActive()
          .getSheetByName('Rule Settings - Campaign')
          .clear();
      });

      it('runs with errors', function () {
        expect(
          SpreadsheetApp.getActive()
            .getSheetByName('Geo Target Change - Results')
            .getDataRange()
            .getValues(),
        ).to.eql([
          [
            'Change',
            'anomalous',
            'Customer ID',
            'Customer Name',
            'Campaign ID',
          ],
          ['Nowhere DELETED, 1 ADDED', 'true', '1', '1', 'c1'],
        ]);
      });

      it('has blank set safely', function () {
        expect(
          SpreadsheetApp.getActive()
            .getSheetByName('Rule Settings - Campaign')
            .getRange(3, 1, 4, 3)
            .getValues(),
        ).to.eql([
          ['ID', 'Campaign Name', 'Criteria IDs'],
          ['default', '', ''],
          ['c1', 'Campaign 1', 'Nowhere'],
          ['c2', 'Campaign 2', '-'],
        ]);
      });
    });

    it('skips disabled rules', async function () {
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
      expect(budgetPacingRuleName).to.equal(ageTargetRule.name);
      expect(geoTargetRuleName).to.equal(geoTargetRule.name);
      // then validate that pacing doesn't work (it's disabled).
      expect(
        SpreadsheetApp.getActive().getSheetByName(
          `${ageTargetRule.name} - Results`,
        ),
      ).not.to.be.undefined;
      expect(
        SpreadsheetApp.getActive()
          .getSheetByName(`${geoTargetRule.name} - Results`)
          .getDataRange()
          .getValues(),
      ).to.deep.eq([]);
    });

    afterEach(function () {
      timer.restore();
    });
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
  sinon.stub(apiFactory, 'create').returns(api);
  const reportFactory = new ReportFactory(apiFactory, {
    customerIds: '1',
    label: 'test',
  });
  return new SearchAdsFrontend({
    ruleRangeClass: RuleRange,
    rules: [geoTargetRule, ageTargetRule],
    version: '3.0',
    clientInitializer(clientArgs, properties) {
      const client = new Client(clientArgs, properties, reportFactory);
      return overrides(client);
    },
    migrations: {},
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
