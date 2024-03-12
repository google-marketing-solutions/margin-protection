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

// g3-format-prettier

import {
  CredentialManager,
  GOOGLEADS_API_ENDPOINT,
  GoogleAdsApi,
  GoogleAdsApiFactory,
  makeReport,
  qlifyQuery,
  ReportFactory,
} from '../ads_api';
import {AdsSearchRequest, buildQuery} from '../ads_api_types';

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
      {queryParams: ['a.one'], queryWheres: [], queryFrom: 'table'},
      [],
    );
    expect(query).toEqual('SELECT a.one FROM table');
  });

  it('builds legible queries when there is one where', () => {
    const query = qlifyQuery(
      {queryParams: ['a.one'], queryWheres: [], queryFrom: 'table'},
      ['foo = "1"'],
    );
    expect(query).toEqual('SELECT a.one FROM table WHERE foo = "1"');
  });

  it('builds legible queries when there are multiple wheres', () => {
    const query = qlifyQuery(
      {queryParams: ['a.one'], queryWheres: [], queryFrom: 'table'},
      ['foo = "1"', 'bar = "2"'],
    );
    expect(query).toEqual(
      'SELECT a.one FROM table WHERE foo = "1" AND bar = "2"',
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
      client as unknown as {requestHeaders(): {}},
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

    expect(rows).toEqual([{customer: {id: 456}}, {customer: {id: 123}}]);
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
      mockQuery.and.callFake(({customerId}) => {
        return iterator({
          a: {one: `${customerId}/one`},
          b: {two: `${customerId}/two`},
          c: {three: `${customerId}/three`},
        });
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
      '1/one': {one: '1/one', two: '1/two', three: '1/three'},
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
      '2/one': {one: '2/one', two: '2/two', three: '2/three'},
      '3/one': {one: '3/one', two: '3/two', three: '3/three'},
    });
  });
});

describe('Join Report', () => {
  let apiFactory: GoogleAdsApiFactory;
  let reportFactory: ReportFactory;
  let api: GoogleAdsApi;

  beforeEach(() => {
    apiFactory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: FAKE_API_ENDPOINT,
    });
    reportFactory = new ReportFactory(apiFactory, {
      customerIds: '',
      label: 'test',
    });
    spyOn(reportFactory, 'create').and.callFake((report) =>
      new ReportFactory(apiFactory, {
        customerIds: '1',
        label: 'test',
      }).create(report),
    );
    api = apiFactory.create('');
    spyOn(apiFactory, 'create').and.returnValue(api);
  });

  it('returns expected results from query', () => {
    const mockQuery: jasmine.Spy = spyOn(api, 'queryOne');
    mockQuery.and.callFake(({query}) => {
      if (query === JOIN_REPORT.query) {
        return iterator({d: {one: 'one', nother: 'another'}});
      } else {
        return iterator({
          a: {one: 'one'},
          b: {two: 'two'},
          c: {another: 'three'},
        });
      }
    });
    const report = reportFactory.create(JOIN_REPORT);
    expect(report.fetch()).toEqual({
      one: {one: 'one', two: 'two', another: 'another'},
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
