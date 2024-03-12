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

import 'jasmine';

import {
    AdsRow,
    AdsSearchRequest,
} from 'common/ads_api_types';

import {
    GoogleAdsApi, 
    GoogleAdsApiFactory, 
    ReportGenerator,
    GOOGLEADS_API_ENDPOINT,
    CredentialManager,
} from 'common/ads_api';

import {AccountMap} from '../types';

import HTTPResponse = GoogleAppsScript.URL_Fetch.HTTPResponse;

describe('Google Ads API Factory', () => {
  it('caches API objects per login ID', () => {
    const factory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: GOOGLEADS_API_ENDPOINT,
    });

    const firstClient = factory.create('123');
    const secondClient = factory.create('456');
    const shouldBeCached = factory.create('123');

    expect(shouldBeCached).not.toBe(secondClient);
    expect(shouldBeCached).toBe(firstClient);
  });
});

describe('Credential Manager', () => {
  let scriptApp: jasmine.SpyObj<typeof ScriptApp>;

  beforeEach(() => {
    scriptApp = globalThis.ScriptApp = jasmine.createSpyObj<typeof ScriptApp>([
      'getOAuthToken',
    ]);
  });

  it('caches credential token', () => {
    const token = 'myBearerToken';
    scriptApp.getOAuthToken.and.returnValue(token);

    const manager = new CredentialManager();
    const firstToken = manager.getToken();
    const secondToken = manager.getToken();

    expect(scriptApp.getOAuthToken).toHaveBeenCalledTimes(1);
    expect(firstToken).toEqual(token);
    expect(secondToken).toEqual(token);
  });
});

describe('Report Generator', () => {
  let apiFactory: GoogleAdsApiFactory;
  let mockQuery: jasmine.Spy<
    (customerId: string, query: string) => IterableIterator<AdsRow>
  >;

  beforeEach(() => {
    apiFactory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: GOOGLEADS_API_ENDPOINT,
    });
    const api = apiFactory.create('');
    spyOn(apiFactory, 'create').and.returnValue(api);
    mockQuery = spyOn(api, 'query');
  });

  describe('MCC hierarchy traversal', () => {
    it('Handles empty account maps', () => {
      const generator = new ReportGenerator([], apiFactory);

      expect(generator.leafAccounts()).toEqual([]);
    });

    it('Handles login leaf accounts', () => {
      const accounts: AccountMap[] = [{customerId: '123'}, {customerId: '456'}];

      mockQuery.and.returnValue(
        iterator({customerClient: {id: 123}}, {customerClient: {id: 456}}),
      );

      const generator = new ReportGenerator(accounts, apiFactory);

      expect(generator.leafAccounts()).toEqual(['123', '456']);
    });

    it('Expands if nested children are empty', () => {
      const accounts: AccountMap[] = [
        {customerId: '123', children: [{customerId: '456', expand: false}]},
      ];
      mockQuery.and.callFake((customerId: string, query: string) => {
        if (customerId !== '456') {
          fail(`Did not expect customerId ${customerId}`);
        }
        return iterator(
          {customerClient: {id: 789}},
          {customerClient: {id: 111}},
        );
      });

      const generator = new ReportGenerator(accounts, apiFactory);

      expect(generator.leafAccounts()).toEqual(['789', '111']);
    });

    it('Expands if requested even with children', () => {
      const accounts: AccountMap[] = [
        {
          customerId: '123',
          children: [
            {customerId: '456', children: [{customerId: '789'}], expand: true},
          ],
        },
      ];

      mockQuery.and.callFake((customerId: string, query: string) => iterator());

      const generator = new ReportGenerator(accounts, apiFactory);
      generator.leafAccounts();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.calls.first().args[0]).toEqual('456');
    });
  });

  describe('Campaign report', () => {
    const accounts: AccountMap[] = [{customerId: 'SOME_MCC'}];
    let mockRows: AdsRow[];

    beforeEach(() => {
      mockRows = [];
      mockQuery.and.callFake((customerId: string, query: string) => {
        if (customerId === 'SOME_MCC') {
          return iterator({customerClient: {id: 123}});
        }
        if (customerId === '123') {
          return iterator(...mockRows);
        }
        fail(`Unexpected customerId ${customerId}`);
        // Unreachable, but makes the type system happy.
        return iterator();
      });
    });

    it('Fetches campaign reports', () => {
      const generator = new ReportGenerator(accounts, apiFactory);
      mockRows.push({
        customer: {id: 123, descriptiveName: 'customer'},
        campaign: {id: 456, descriptiveName: 'campaign', status: 'ENABLED'},
      });

      const reports = generator.campaignReports();

      expect(reports).toEqual([
        {
          customerId: '123',
          customerName: 'customer',
          id: '456',
          name: 'campaign',
          status: 'ENABLED',
        },
      ]);
    });

    it('Handles empty report rows', () => {
      const generator = new ReportGenerator(accounts, apiFactory);

      const reports = generator.campaignReports();

      expect(reports).toEqual([]);
    });
  });
});

describe('Google Ads API Client', () => {
  let fetchApp: jasmine.SpyObj<typeof UrlFetchApp>;
  let httpResponse: jasmine.SpyObj<HTTPResponse>;

  function getSearchRequestPayload(idx = 0): AdsSearchRequest {
    return JSON.parse(
      fetchApp.fetch.calls.all()[idx].args[1].payload! as string,
    ) as AdsSearchRequest;
  }

  beforeEach(() => {
    fetchApp = globalThis.UrlFetchApp = jasmine.createSpyObj<
      typeof UrlFetchApp
    >(['fetch']);
    httpResponse = jasmine.createSpyObj<HTTPResponse>(['getContentText']);
    httpResponse.getContentText.and.returnValue(
      '{"results": [{"customer": { "id": 123 }}]}',
    );
    fetchApp.fetch.and.returnValue(httpResponse);
  });

  it('Passes developer-token header', () => {
    const developerToken = 'myDevToken';

    const client = createClient(developerToken);
    client.query('customerId', 'my query').next();

    const actualToken =
      fetchApp.fetch.calls.mostRecent().args[1].headers!['developer-token'];
    expect(actualToken).toEqual(developerToken);
  });

  it('Passes login-customer-id header', () => {
    const loginCustomerId = '1234567890';

    const client = createClient('', loginCustomerId);
    client.query('customerId', 'my query').next();

    const actualLoginCustomerId =
      fetchApp.fetch.calls.mostRecent().args[1].headers!['login-customer-id'];
    expect(actualLoginCustomerId).toEqual(loginCustomerId);
  });

  it('Passes Authorization header', () => {
    const token = 'myBearerToken';
    const credentialManager = new CredentialManager();
    const getTokenSpy = spyOn(credentialManager, 'getToken').and.returnValue(
      token,
    );

    const client = createClient('', '', credentialManager);
    client.query('customerId', 'my query').next();

    expect(getTokenSpy).toHaveBeenCalledTimes(1);
    const actualToken =
      fetchApp.fetch.calls.mostRecent().args[1].headers!['Authorization'];
    expect(actualToken).toEqual(`Bearer ${token}`);
  });

  it('Has customer ID in payload', () => {
    const myCustomerId = 'thisIsMyCustomerId';

    const client = createClient();
    client.query(myCustomerId, 'my query').next();

    const payload = getSearchRequestPayload();
    expect(payload.customerId).toEqual(myCustomerId);
  });

  it('Has query in payload', () => {
    const myQuery = 'SELECT "My Query"';

    const client = createClient();
    client.query('customerId', myQuery).next();

    const payload = getSearchRequestPayload();
    expect(payload.query).toEqual(myQuery);
  });

  it('Handles paginated results', () => {
    const firstHttpResponse = jasmine.createSpyObj<HTTPResponse>([
      'getContentText',
    ]);
    firstHttpResponse.getContentText.and.returnValue(
      '{"results": [{"customer": { "id": 456 }}], "nextPageToken": "pointer"}',
    );
    fetchApp.fetch.and.returnValues(firstHttpResponse, httpResponse);

    const client = createClient();
    const rows = [...client.query('customerId', 'my query')];

    expect(fetchApp.fetch).toHaveBeenCalledTimes(2);

    const firstPayload = getSearchRequestPayload(0);
    expect(firstPayload.pageToken).not.toBeDefined();
    const lastPayload = getSearchRequestPayload(1);
    expect(lastPayload.pageToken).toEqual('pointer');

    expect(rows).toEqual([{customer: {id: 456}}, {customer: {id: 123}}]);
  });

  it('Handles empty results', () => {
    httpResponse.getContentText.and.returnValue('{"results": []}');

    const client = createClient();
    const rows = [...client.query('customerId', 'my query')];

    expect(fetchApp.fetch).toHaveBeenCalledTimes(1);

    expect(rows).toEqual([]);
  });
});

function createClient(
  developerToken = '',
  loginCustomerId = '',
  credentialManager = new CredentialManager(),
): GoogleAdsApi {
  return new GoogleAdsApi({
    developerToken,
    loginCustomerId,
    credentialManager,
    apiEndpoint: GOOGLEADS_API_ENDPOINT
  });
}

function iterator<T>(...a: T[]): IterableIterator<T> {
  return a[Symbol.iterator]();
}
