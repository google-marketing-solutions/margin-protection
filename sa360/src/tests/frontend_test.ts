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
  beforeEach(() => {
    mockAppsScript();
    fillInSettings();
    frontend = createFrontend();
  });
  it('runs onOpen without any setup required', async () => {
    expect(frontend.onOpen).not.toThrowError();
  });

  for (const method of [
    'initializeRules',
    'initializeSheets',
    'preLaunchQa',
    'launchMonitor',
  ]) {
    it(`does not run ${method} without setup`, async () => {
      mockHtmlService();
      let called = false;
      const uiMock = spyOn(globalThis.SpreadsheetApp, 'getUi').and.callFake(
        () =>
          ({
            showModalDialog() {
              called = true;
            },
          }) as unknown as Ui,
      );
      const spy = spyOn(frontend, 'displaySetupModal').and.callFake(() => {
        called = true;
      });
      HELPERS.applyAnomalyHelper = () => {};
      await frontend[method]();
      expect(called).toBeTrue();
    });
  }
});

function mockHtmlService() {
  HtmlService.createTemplateFromFile = jasmine
    .createSpy()
    .and.callFake((filename: string) => {
      const evaluate = () => {
        console.log(filename);
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

function createFrontend() {
  globalThis.SpreadsheetApp.getUi = jasmine.createSpy();
  const selfReference = {
    createMenu() {
      return this;
    },
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
  globalThis.SpreadsheetApp.getUi = () =>
    ({
      createMenu() {
        return selfReference;
      },
    }) as unknown as Ui;
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
