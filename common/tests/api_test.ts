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
 * @fileoverview Tests for the common API library suites.
 */

import {
  CredentialManager,
  GET_LEAF_ACCOUNTS_REPORT,
  GOOGLEADS_API_ENDPOINT,
  GoogleAdsApi,
  GoogleAdsApiFactory,
  makeReport,
  qlifyQuery,
  ReportFactory,
  SA360_API_ENDPOINT,
} from '../ads_api';
import { AdsSearchRequest, buildQuery } from '../ads_api_types';
import {
  generateFakeHttpResponse,
  mockAppsScript,
} from '../test_helpers/mock_apps_script';

import { bootstrapGoogleAdsApi } from './helpers';

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

describe('qlifyQuery', () => {
  it('builds legible queries when there are no wheres', () => {
    const query = qlifyQuery(
      { queryParams: ['a.one'], queryWheres: [], queryFrom: 'table' },
      [],
    );
    expect(query).toEqual('SELECT a.one FROM table');
  });

  it('builds legible queries when there is one where', () => {
    const query = qlifyQuery(
      { queryParams: ['a.one'], queryWheres: [], queryFrom: 'table' },
      ['foo = "1"'],
    );
    expect(query).toEqual('SELECT a.one FROM table WHERE foo = "1"');
  });

  it('builds legible queries when there are multiple wheres', () => {
    const query = qlifyQuery(
      { queryParams: ['a.one'], queryWheres: [], queryFrom: 'table' },
      ['foo = "1"', 'bar = "2"'],
    );
    expect(query).toEqual(
      'SELECT a.one FROM table WHERE foo = "1" AND bar = "2"',
    );
  });
});

describe('Google Ads API', () => {
  let url = '';

  beforeEach(() => {
    mockAppsScript();
    spyOn(UrlFetchApp, 'fetch').and.callFake((requestUrl: string) => {
      url = requestUrl;

      return generateFakeHttpResponse({ contentText: '{}' });
    });
  });

  it('has a well-formed URL for GOOGLEADS_API_ENDPOINT', () => {
    const factory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: GOOGLEADS_API_ENDPOINT,
    });
    const api = factory.create('123');
    api.query('1', FAKE_REPORT.query).next();

    expect(url).toEqual(
      'https://googleads.googleapis.com/v11/customers/1/googleAds:search',
    );
  });

  it('has a well-formed URL for SA360_API_ENDPOINT', () => {
    const factory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: SA360_API_ENDPOINT,
    });
    const api = factory.create('123');
    api.query('1', FAKE_REPORT.query).next();

    expect(url).toEqual(
      'https://searchads360.googleapis.com/v0/customers/1/searchAds360:search',
    );
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

describe('Google Ads API Client', () => {
  let fetchApp: jasmine.SpyObj<typeof UrlFetchApp>;
  let httpResponse: jasmine.SpyObj<HTTPResponse>;

  function getSearchRequestPayload(idx = 0): AdsSearchRequest {
    return JSON.parse(
      fetchApp.fetch.calls.all()[idx].args[1].payload! as string,
    ) as AdsSearchRequest;
  }

  beforeEach(() => {
    mockAppsScript();
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
    client.query('1', FAKE_REPORT['query']).next();

    const actualToken =
      fetchApp.fetch.calls.mostRecent().args[1].headers!['developer-token'];
    expect(actualToken).toEqual(developerToken);
  });

  it('Passes login-customer-id header', () => {
    const loginCustomerId = '1234567890';

    const client = createClient('', loginCustomerId);
    client.query('1', FAKE_REPORT.query).next();

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
    client.query('1', FAKE_REPORT.query).next();

    expect(getTokenSpy).toHaveBeenCalledTimes(1);
    const actualToken =
      fetchApp.fetch.calls.mostRecent().args[1].headers!['Authorization'];
    expect(actualToken).toEqual(`Bearer ${token}`);
  });

  it('Has customer ID in payload', () => {
    const client = createClient();
    client.query('1', FAKE_REPORT.query).next();

    const payload = getSearchRequestPayload();
    expect(payload.customerId).toEqual('1');
  });

  it('Has query in payload', () => {
    const client = createClient();
    spyOn(
      client as unknown as { requestHeaders(): {} },
      'requestHeaders',
    ).and.returnValue({});
    client.query('1', FAKE_REPORT.query).next();
    const token = 'myBearerToken';
    const credentialManager = new CredentialManager();
    spyOn(credentialManager, 'getToken').and.returnValue(token);

    const payload = getSearchRequestPayload();
    expect(payload.query).toEqual(
      `SELECT ${FAKE_REPORT.query.queryParams.join(', ')} FROM ${
        FAKE_REPORT.query.queryFrom
      }`,
    );
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
    const rows = [...client.query('1', CUSTOMER_QUERY)];

    expect(fetchApp.fetch).toHaveBeenCalledTimes(2);

    const firstPayload = getSearchRequestPayload(0);
    expect(firstPayload.pageToken).not.toBeDefined();
    const lastPayload = getSearchRequestPayload(1);
    expect(lastPayload.pageToken).toEqual('pointer');

    expect(rows).toEqual([
      { customer: { id: 456 } },
      { customer: { id: 123 } },
    ]);
  });

  it('Handles empty results', () => {
    httpResponse.getContentText.and.returnValue('{"results": []}');

    const client = createClient();
    const rows = [...client.query('1', FAKE_REPORT.query)];

    expect(fetchApp.fetch).toHaveBeenCalledTimes(1);

    expect(rows).toEqual([]);
  });
});

describe('Report Factory', () => {
  let apiFactory: GoogleAdsApiFactory;
  let reportFactory: ReportFactory;

  beforeEach(() => {
    apiFactory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: FAKE_API_ENDPOINT,
    });
    spyOn(apiFactory, 'create').and.callFake((loginCustomerId: string) => {
      const api = new GoogleAdsApiFactory({
        developerToken: '',
        credentialManager: new CredentialManager(),
        apiEndpoint: FAKE_API_ENDPOINT,
      }).create(loginCustomerId);
      const mockQuery: jasmine.Spy = spyOn(api, 'queryOne');
      mockQuery.and.callFake(({ query, customerId }) => {
        if (query === FAKE_REPORT.query) {
          return iterator({
            a: { one: `${customerId}/one` },
            b: { two: `${customerId}/two` },
            c: { three: `${customerId}/three` },
          });
        } else {
          return iterator(
            {
              customerClient: { id: '2' },
            },
            {
              customerClient: { id: '3' },
            },
          );
        }
      });
      return api;
    });
    reportFactory = new ReportFactory(apiFactory, {
      customerIds: '1',
      label: 'test',
    });
  });

  it('returns expected results from query', () => {
    const report = reportFactory.create(FAKE_REPORT);
    expect(report.fetch()).toEqual({
      '2/one': { one: '2/one', two: '2/two', three: '2/three' },
      '3/one': { one: '3/one', two: '3/two', three: '3/three' },
    });
  });

  it('Errors when multiple CIDs are set with no login customer ID', () => {
    const multiFactory = new ReportFactory(apiFactory, {
      customerIds: '1,2,3,4,5',
      label: 'test',
    });

    expect(() => multiFactory.create(FAKE_REPORT)).toThrowError(
      'Please provide a single login customer ID for multiple CIDs.',
    );
  });

  it('Infers all login customer IDs when none is set', () => {
    const multiFactory = new ReportFactory(apiFactory, {
      loginCustomerId: '1',
      customerIds: '2,3',
      label: 'test',
    });
    const report = multiFactory.create(FAKE_REPORT);

    expect(report.fetch()).toEqual({
      '2/one': { one: '2/one', two: '2/two', three: '2/three' },
      '3/one': { one: '3/one', two: '3/two', three: '3/three' },
    });
  });
});

describe('Join Report', () => {
  let reportFactory: ReportFactory;
  let api: GoogleAdsApi;
  let mockQuery: jasmine.Spy;

  beforeEach(() => {
    ({ reportFactory, api, mockQuery } = bootstrapGoogleAdsApi());
  });

  it('returns expected results from query', () => {
    mockQuery.and.callFake(({ query }) => {
      if (query === JOIN_REPORT.query) {
        return iterator(
          { d: { one: 'one', nother: 'another' } },
          { d: { one: '1' } },
        );
      } else if (query === GET_LEAF_ACCOUNTS_REPORT.query) {
        return iterator({
          customerClient: { id: '1' },
        });
      } else {
        return iterator({
          a: { one: 'one' },
          b: { two: 'two' },
          c: { another: 'three' },
        });
      }
    });
    const report = reportFactory.create(JOIN_REPORT);
    expect(report.fetch()).toEqual({
      one: { one: 'one', two: 'two', another: 'another' },
    });
  });
});

describe('Join query handling', () => {
  let reportFactory: ReportFactory;
  let mockQuery: jasmine.Spy;
  let api: GoogleAdsApi;
  const qlifyStack: string[] = [];

  beforeEach(() => {
    ({ reportFactory, mockQuery, api } = bootstrapGoogleAdsApi());
    const qlifyQuery = api.qlifyQuery;
    mockQuery.and.callThrough();
    spyOn(api, 'qlifyQuery').and.callFake((query, queryWheres) => {
      const aql = qlifyQuery(query, queryWheres);
      qlifyStack.push(aql);
      return aql;
    });
    mockAppsScript();
    spyOn(UrlFetchApp, 'fetch').and.callFake((...args: any[]) => {
      const request = args[1];
      const payload = JSON.parse(request.payload as string) as {
        query: string;
      };
      if (payload.query === 'SELECT d.one, d.nother FROM the_main_table') {
        return {
          getContentText() {
            return JSON.stringify({
              results: [
                { d: { one: '1', nother: 'another' } },
                { d: { one: '11', nother: 'yet another' } },
                // this value doesn't exist - but should still be queried.
                { d: { one: '111', nother: 'yet another' } },
              ],
            });
          },
        } as HTTPResponse;
      }
      const joinedPayload = {
        results: [
          {
            a: { one: '1' },
            b: { two: '2' },
            c: { three: '3' },
          },
          {
            a: { one: '11' },
            b: { two: '22' },
            c: { three: '3' },
          },
        ],
      };
      return {
        getContentText() {
          return JSON.stringify(joinedPayload);
        },
      } as HTTPResponse;
    });
  });

  it('joins on IDs that exist', () => {
    const report = reportFactory.create(JOIN_REPORT);
    report.fetch();
    expect(qlifyStack.pop()).toEqual(
      'SELECT a.one, b.two, c.three FROM something WHERE something.id IN (1,11,111)',
    );
  });
});

describe('Leaf expansion', () => {
  let reportFactory: ReportFactory;
  let api: GoogleAdsApi;
  let mockQuery: jasmine.Spy;
  const mockLeafAccounts: Record<string, string[]> = { '123': ['1', '2', '3'] };

  beforeEach(() => {
    ({ reportFactory, api, mockQuery } = bootstrapGoogleAdsApi({
      mockLeafAccounts,
      spyOnLeaf: false,
    }));
  });

  it('checks all expanded accounts are added to the report', () => {
    mockQuery.and.callFake(({ customerId, query }) => {
      if (query === GET_LEAF_ACCOUNTS_REPORT.query) {
        return iterator(
          ...mockLeafAccounts[customerId].map((id) => ({
            customerClient: { id, name: `customer ${id}`, status: 'ENABLED' },
          })),
        );
      } else {
        return iterator({
          customerId,
          a: { id: customerId },
        });
      }
    });
    const report = reportFactory.create(FAKE_REPORT_2);
    expect(report.fetch()).toEqual({
      'customers/1/id/a1': { customerId: '1', id: 'a1' },
      'customers/2/id/a2': { customerId: '2', id: 'a2' },
      'customers/3/id/a3': { customerId: '3', id: 'a3' },
    });
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
    apiEndpoint: GOOGLEADS_API_ENDPOINT,
  });
}

function iterator<T>(...a: T[]): IterableIterator<T> {
  return a[Symbol.iterator]();
}

const FAKE_API_ENDPOINT = {
  url: 'my://url',
  version: 'v0',
  call: 'fake:endpoint',
};

const CUSTOMER_QUERY = buildQuery({
  queryParams: ['customer.id'],
  queryFrom: 'customer',
});

const FAKE_REPORT = makeReport({
  output: ['one', 'two', 'three'],
  query: buildQuery({
    queryParams: ['a.one', 'b.two', 'c.three'],
    queryFrom: 'something',
  }),
  transform(result) {
    return [
      result.a.one as string,
      {
        one: result.a.one as string,
        two: result.b.two as string,
        three: result.c.three as string,
      },
    ] as const;
  },
});

const FAKE_REPORT_2 = makeReport({
  output: ['customerId', 'id'],
  query: buildQuery({
    queryParams: ['a.id', 'customerId'],
    queryFrom: 'something',
  }),
  transform(result) {
    return [
      `customers/${result.customerId}/id/a${result.a.id}` as string,
      {
        customerId: result.customerId as string,
        id: `a${result.a.id}`,
      },
    ] as const;
  },
});

const JOIN_REPORT = makeReport({
  output: ['one', 'another', 'two'],
  query: buildQuery({
    queryParams: ['d.one', 'd.nother'],
    queryFrom: 'the_main_table',
    joins: {
      'd.one': FAKE_REPORT,
    },
  }),
  transform(result, joins) {
    return [
      result.d.one as string,
      {
        one: result.d.one as string,
        another: result.d.nother as string,
        two: joins['d.one'][result.d.one as string].two as string,
      },
    ] as const;
  },
});
