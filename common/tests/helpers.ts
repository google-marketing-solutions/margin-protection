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
 * @fileoverview Test helpers for the common library.
 */

import { ClientTypes } from '../types';
import { FakePropertyStore } from '../test_helpers/mock_apps_script';

import {
  CredentialManager,
  GET_LEAF_ACCOUNTS_REPORT,
  GoogleAdsApi,
  GoogleAdsApiFactory,
  ReportFactory,
} from '../ads_api';
import { AbstractRuleRange, AppsScriptFrontend } from '../sheet_helpers';
import {
  AppsScriptFunctions,
  BaseClientArgs,
  BaseClientInterface,
  ExecutorResult,
  FrontendArgs,
  ParamDefinition,
  RecordInfo,
  RuleExecutor,
  RuleExecutorClass,
  RuleGetter,
} from '../types';

/**
 * Test granularity for use in tests.
 */
export enum Granularity {
  DEFAULT = 'default',
}

export interface TestClientTypes extends ClientTypes<TestClientTypes> {
  client: TestClientInterface;
  ruleGranularity: Granularity;
  clientArgs: ClientArgs;
}

interface ClientArgs extends BaseClientArgs<ClientArgs> {}

/**
 * Test client interface for use in tests.
 */
export interface TestClientInterface
  extends BaseClientInterface<TestClientTypes> {
  id: string;
  getAllCampaigns(): Promise<RecordInfo[]>;
}

/**
 * Test ad client interface for use in tests.
 */
export interface AdsClientInterface
  extends BaseClientInterface<TestClientTypes> {
  id: string;
  getAllCampaigns(): Promise<RecordInfo[]>;
}

/**
 * Stub for rule range
 */
export class RuleRange extends AbstractRuleRange<TestClientTypes> {
  async getRows() {
    return [{ id: '1', displayName: 'Campaign 1', advertiserId: '1' }];
  }
}

/**
 * Test client for use in tests.
 */
export class FakeClient implements TestClientInterface {
  readonly args: ClientArgs = { label: 'test' };
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<TestClientTypes>;
  } = {};
  readonly properties = new FakePropertyStore();

  getRule(
    ruleName: string,
  ): RuleExecutor<TestClientTypes, Record<string, ParamDefinition>> {
    throw new Error('Method not implemented.');
  }
  getUniqueKey(prefix: string): string {
    throw new Error('Method not implemented.');
  }
  validate(): Promise<{
    rules: Record<
      string,
      RuleExecutor<TestClientTypes, Record<string, ParamDefinition>>
    >;
    results: Record<string, ExecutorResult>;
  }> {
    throw new Error('Method not implemented.');
  }
  addRule<Params extends Record<keyof Params, ParamDefinition>>(
    rule: RuleExecutorClass<TestClientTypes, Params>,
    settingsArray: ReadonlyArray<string[]>,
  ): TestClientInterface {
    throw new Error('Method not implemented.');
  }
  id = 'something';

  getAllCampaigns(): Promise<[]> {
    return Promise.resolve([]);
  }
}

/**
 * A fake frontend for testing.
 */
<<<<<<< HEAD
export class FakeFrontend extends AppsScriptFrontend<TestClientTypes> {
=======
export class FakeFrontend extends AppsScriptFrontend<
  TestClientInterface,
  Granularity,
  BaseClientArgs,
  FakeFrontend
> {
>>>>>>> 496c709 (Minor cleanup (#13))
  readonly calls: Record<AppsScriptFunctions, number> = {
    onOpen: 0,
    initializeSheets: 0,
    launchMonitor: 0,
    preLaunchQa: 0,
    displaySetupGuide: 0,
    displayGlossary: 0,
  };
  private readonly messages: GoogleAppsScript.Mail.MailAdvancedParameters[] =
    [];
  private readonly old: GoogleAppsScript.Mail.MailAdvancedParameters[] = [];

<<<<<<< HEAD
  constructor(args: FrontendArgs<TestClientTypes>) {
=======
  constructor(
    args: FrontendArgs<
      TestClientInterface,
      Granularity,
      BaseClientArgs,
      FakeFrontend
    >,
  ) {
>>>>>>> 496c709 (Minor cleanup (#13))
    scaffoldSheetWithNamedRanges();
    super('Fake', args);
  }

  getIdentity(): ClientArgs {
    return { label: 'test' };
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

  override async sendEmailAlert(
    rules: RuleGetter[],
    message: GoogleAppsScript.Mail.MailAdvancedParameters,
  ) {
    const noop: GoogleAppsScript.Mail.MailApp['sendEmail'] = ((
      message: GoogleAppsScript.Mail.MailAdvancedParameters,
    ) => {}) as GoogleAppsScript.Mail.MailApp['sendEmail'];
    super.sendEmailAlert(rules, message, noop);

    this.messages.push(message);
  }

  getMessages() {
    this.old.splice(0, 0, ...this.messages);
    return this.messages.splice(0, this.messages.length);
  }
}

/**
 * Set up named ranges so basic things can work in frontend.
 */
export function scaffoldSheetWithNamedRanges() {
  for (const [i, [constName, value]] of [
    ['ENTITY_ID', '1'],
    ['ID_TYPE', 'Advertiser'],
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

const FAKE_API_ENDPOINT = {
  url: 'my://url',
  version: 'v0',
  call: 'fake:call',
};

/**
 * Set up a Google Ads API for testing.
 */
export function bootstrapGoogleAdsApi(
  {
    mockLeafAccounts = { '1': ['123'] },
    spyOnLeaf = true,
  }: { mockLeafAccounts: Record<string, string[]>; spyOnLeaf: boolean } = {
    mockLeafAccounts: { '1': ['123'] },
    spyOnLeaf: true,
  },
) {
  const apiFactory = new GoogleAdsApiFactory({
    developerToken: '',
    credentialManager: new CredentialManager(),
    apiEndpoint: FAKE_API_ENDPOINT,
  });
  const reportFactory = new ReportFactory(apiFactory, {
    loginCustomerId: 'la1',
    customerIds: Object.keys(mockLeafAccounts).join(','),
    label: 'test',
  });
  if (spyOnLeaf) {
    spyOn(reportFactory, 'leafAccounts').and.returnValue(['1']);
  }
  const api = new GoogleAdsApi({
    developerToken: '',
    loginCustomerId: 'la1',
    credentialManager: {
      getToken() {
        return '';
      },
    },
    apiEndpoint: FAKE_API_ENDPOINT,
  });
  const mockQuery: jasmine.Spy = spyOn(api, 'queryOne');
  spyOn(apiFactory, 'create').and.callFake(() => api);
  return { api, reportFactory, mockQuery };
}

/**
 * Like TestClientInterface only for Ads.
 */
export interface AdsClientInterface
  extends BaseClientInterface<TestClientTypes> {}

/**
 * Create an iterator from a list of options.
 */
export function iterator<T>(...a: T[]): IterableIterator<T> {
  return a[Symbol.iterator]();
}
