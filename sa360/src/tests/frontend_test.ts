import { SearchAdsFrontend } from 'sa360/src/frontend';
import { Client, RuleRange } from 'sa360/src/client';
import {
  CredentialManager,
  GoogleAdsApiFactory,
  ReportFactory,
  SA360_API_ENDPOINT,
} from 'common/ads_api';
import {
  FakePropertyStore,
  mockAppsScript,
} from 'common/test_helpers/mock_apps_script';
import { HELPERS } from 'common/sheet_helpers';

describe('Frontend methods', () => {
  let frontend: SearchAdsFrontend;
  let called = '';

  beforeEach(() => {
    mockAppsScript();
    fillInSettings();
    mockHtmlService();
    frontend = createFrontend({
      showModalDialog() {
        called = 'modal';
        return this;
      },
      showSidebar() {
        called = 'sidebar';
        return this;
      },
    });
  });

  afterEach(() => {
    called = '';
  });

  for (const method of ['onOpen', 'displayGlossary', 'displaySetupModal']) {
    it(`runs ${method} without any setup required`, async () => {
      expect(async () => await frontend[method]()).not.toThrowError();
    });
  }

  for (const method of [
    'initializeRules',
    'initializeSheets',
    'preLaunchQa',
    'launchMonitor',
  ]) {
    it(`does not run ${method} without setup`, async () => {
      HELPERS.applyAnomalyHelper = () => {};
      await frontend[method]();
      expect(called).toEqual('modal');
    });
  }
});

function mockHtmlService() {
  HtmlService.createTemplateFromFile = jasmine
    .createSpy()
    .and.callFake((filename: string) => {
      const evaluate = () => {
        return {
          setWidth() {
            return this;
          },
          setHeight() {
            return this;
          },
        };
      };
      return { evaluate };
    });
}
/**
 * Fill in settings so the tests think this works.
 */
function fillInSettings() {
  const active = SpreadsheetApp.getActive();
  const sheet = active.insertSheet('Test');
  active.setNamedRange('LOGIN_CUSTOMER_ID', sheet.getRange('A1').setValue(''));
  active.setNamedRange('CUSTOMER_IDS', sheet.getRange('A2').setValue(''));
  active.setNamedRange(
    'LABEL',
    sheet.getRange('A3').setValue('email@acme.com'),
  );
  active.setNamedRange('FULL_FETCH', sheet.getRange('A4'));
  active.setNamedRange('EMAIL_LIST', sheet.getRange('A5'));
}

function createFrontend(extras: Record<string, Function>) {
  const selfReference = {
    addItem() {
      return this;
    },
    addSeparator() {
      return this;
    },
    addSubMenu() {
      return this;
    },
    addToUi() {},
  };
  SpreadsheetApp.getUi = jasmine.createSpy().and.callFake(
    () =>
      ({
        createMenu() {
          return selfReference;
        },
        ...extras,
      }) as unknown as GoogleAppsScript.Base.Ui,
  );
  return new SearchAdsFrontend({
    ruleRangeClass: RuleRange,
    rules: [],
    version: '0.0',
    clientInitializer(clientArgs, properties) {
      const apiFactory = new GoogleAdsApiFactory({
        developerToken: '',
        credentialManager: new CredentialManager(),
        apiEndpoint: SA360_API_ENDPOINT,
      });
      const reportFactory = new ReportFactory(apiFactory, clientArgs);
      return new Client(clientArgs, properties, reportFactory);
    },
    migrations: {},
    properties: new FakePropertyStore(),
  });
}
