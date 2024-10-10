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
import {AdsSearchRequest, buildQuery} from '../ads_api_types';
import {
  generateFakeHttpResponse,
  mockAppsScript,
} from '../test_helpers/mock_apps_script';

import {bootstrapGoogleAdsApi, tearDownStubs} from './helpers';
import * as sinon from 'sinon';
import {expect, use} from 'chai';
import sinonChai from 'sinon-chai';
use(sinonChai);

import HTTPResponse = GoogleAppsScript.URL_Fetch.HTTPResponse;

describe('Google Ads API Factory', function () {
  it('caches API objects per login ID', function () {
    const factory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: GOOGLEADS_API_ENDPOINT,
    });

    const firstClient = factory.create('123');
    const secondClient = factory.create('456');
    const shouldBeCached = factory.create('123');

    expect(shouldBeCached).not.to.equal(secondClient);
    expect(shouldBeCached).to.equal(firstClient);
  });
});

describe('qlifyQuery', function () {
  it('builds legible queries when there are no wheres', function () {
    const query = qlifyQuery(
      {queryParams: ['a.one'], queryWheres: [], queryFrom: 'table'},
      [],
    );
    expect(query).to.equal('SELECT a.one FROM table');
  });

  it('builds legible queries when there is one where', function () {
    const query = qlifyQuery(
      {queryParams: ['a.one'], queryWheres: [], queryFrom: 'table'},
      ['foo = "1"'],
    );
    expect(query).to.equal('SELECT a.one FROM table WHERE foo = "1"');
  });

  it('builds legible queries when there are multiple wheres', function () {
    const query = qlifyQuery(
      {queryParams: ['a.one'], queryWheres: [], queryFrom: 'table'},
      ['foo = "1"', 'bar = "2"'],
    );
    expect(query).to.equal(
      'SELECT a.one FROM table WHERE foo = "1" AND bar = "2"',
    );
  });
});

describe('Google Ads API', function () {
  let url = '';

  beforeEach(function () {
    mockAppsScript();
    sinon.stub(UrlFetchApp, 'fetch').callsFake((requestUrl: string) => {
      url = requestUrl;

      return generateFakeHttpResponse({contentText: '{}'});
    });
  });

  it('has a well-formed URL for GOOGLEADS_API_ENDPOINT', function () {
    const factory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: GOOGLEADS_API_ENDPOINT,
    });
    const api = factory.create('123');
    api.query('1', FAKE_REPORT.query).next();

    expect(url).to.equal(
      'https://googleads.googleapis.com/v11/customers/1/googleAds:search',
    );
  });

  it('has a well-formed URL for SA360_API_ENDPOINT', function () {
    const factory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: SA360_API_ENDPOINT,
    });
    const api = factory.create('123');
    api.query('1', FAKE_REPORT.query).next();

    expect(url).to.equal(
      'https://searchads360.googleapis.com/v0/customers/1/searchAds360:search',
    );
  });
});

describe('Credential Manager', function () {
  beforeEach(function () {
    this.token = 'myBearerToken';
    this.stub = sinon.stub(ScriptApp, 'getOAuthToken').returns(this.token);
  });

  it('caches credential token', function () {
    const manager = new CredentialManager();
    const firstToken = manager.getToken();
    const secondToken = manager.getToken();

    expect(ScriptApp.getOAuthToken).to.have.been.calledOnce;
    expect(firstToken).to.equal(this.token);
    expect(secondToken).to.equal(this.token);
  });

  afterEach(function () {
    this.stub.restore();
  });
});

describe('Google Ads API Client', function () {
  let fetch: sinon.SinonStub;
  let getContentText: sinon.SinonStub;

  function getSearchRequestPayload(idx = 0): AdsSearchRequest {
    return JSON.parse(
      fetch.getCalls()[idx].args[1].payload! as string,
    ) as AdsSearchRequest;
  }

  beforeEach(function () {
    mockAppsScript();
    this.httpResponse = generateFakeHttpResponse({contentText: 'hello world'});
    fetch = sinon.stub(UrlFetchApp, 'fetch');
    getContentText = sinon
      .stub(this.httpResponse, 'getContentText')
      .returns('{"results": [{"customer": { "id": 123 }}]}');
    fetch.returns(this.httpResponse);
  });

  afterEach(function () {
    tearDownStubs([getContentText]);
  });

  it('Passes developer-token header', function () {
    const developerToken = 'myDevToken';

    const client = createClient(developerToken);
    client.query('1', FAKE_REPORT['query']).next();

    const actualToken = fetch.lastCall.args[1].headers!['developer-token'];
    expect(actualToken).to.equal(developerToken);
  });

  it('Passes login-customer-id header', function () {
    const loginCustomerId = '1234567890';

    const client = createClient('', loginCustomerId);
    client.query('1', FAKE_REPORT.query).next();
    const actualLoginCustomerId =
      fetch.lastCall.args[1].headers!['login-customer-id'];
    expect(actualLoginCustomerId).to.equal(loginCustomerId);
  });

  it('Passes Authorization header', function () {
    const token = 'myBearerToken';
    const credentialManager = new CredentialManager();
    const getTokenSpy = sinon
      .stub(credentialManager, 'getToken')
      .returns(token);

    const client = createClient('', '', credentialManager);
    client.query('1', FAKE_REPORT.query).next();

    expect(getTokenSpy).to.have.been.calledOnce;
    const actualToken = fetch.lastCall.args[1].headers!['Authorization'];
    expect(actualToken).to.equal(`Bearer ${token}`);
  });

  it('Has customer ID in payload', function () {
    const client = createClient();
    client.query('1', FAKE_REPORT.query).next();

    const payload = getSearchRequestPayload();
    expect(payload.customerId).to.equal('1');
  });

  it('Has query in payload', function () {
    const client = createClient();
    sinon
      .stub(client as unknown as {requestHeaders(): object}, 'requestHeaders')
      .returns({});
    client.query('1', FAKE_REPORT.query).next();
    const token = 'myBearerToken';
    const credentialManager = new CredentialManager();
    sinon.stub(credentialManager, 'getToken').returns(token);

    const payload = getSearchRequestPayload();
    expect(payload.query).to.equal(
      `SELECT ${FAKE_REPORT.query.queryParams.join(', ')} FROM ${
        FAKE_REPORT.query.queryFrom
      }`,
    );
  });

  it('Handles paginated results', function () {
    const firstHttpResponse = sinon.stub<HTTPResponse>(
      generateFakeHttpResponse({contentText: 'foo'}),
    );
    firstHttpResponse.getContentText.returns(
      '{"results": [{"customer": { "id": 456 }}], "nextPageToken": "pointer"}',
    );
    const urls = new Set<string>();
    fetch.callsFake((_, req) => {
      if (JSON.parse(req.payload)['pageToken'] === 'pointer') {
        return this.httpResponse;
      }
      return firstHttpResponse;
    });

    const client = createClient();
    const rows = [...client.query('1', CUSTOMER_QUERY)];
    console.log([...urls]);

    expect(fetch).to.have.been.calledTwice;

    const firstPayload = getSearchRequestPayload(0);
    expect(firstPayload.pageToken).to.be.undefined;
    const lastPayload = getSearchRequestPayload(1);
    expect(lastPayload.pageToken).to.equal('pointer');

    expect(rows).to.deep.eq([{customer: {id: 456}}, {customer: {id: 123}}]);
  });

  it('Handles empty results', function () {
    getContentText.returns('{"results": []}');

    const client = createClient();
    const rows = [...client.query('1', FAKE_REPORT.query)];

    expect(fetch).to.have.been.calledOnce;

    expect(rows).to.deep.eq([]);
  });
});

describe('Report Factory', function () {
  let apiFactory: GoogleAdsApiFactory;
  let reportFactory: ReportFactory;

  beforeEach(function () {
    apiFactory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: FAKE_API_ENDPOINT,
    });
    sinon.stub(apiFactory, 'create').callsFake((loginCustomerId: string) => {
      const api = new GoogleAdsApiFactory({
        developerToken: '',
        credentialManager: new CredentialManager(),
        apiEndpoint: FAKE_API_ENDPOINT,
      }).create(loginCustomerId);
      const mockQuery: sinon.SinonStub = sinon.stub(api, 'queryOne');
      mockQuery.callsFake(({query, customerId}) => {
        if (query === FAKE_REPORT.query) {
          return iterator({
            a: {one: `${customerId}/one`},
            b: {two: `${customerId}/two`},
            c: {three: `${customerId}/three`},
          });
        } else {
          return iterator(
            {
              customerClient: {id: '2'},
            },
            {
              customerClient: {id: '3'},
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

  it('returns expected results from query', function () {
    const report = reportFactory.create(FAKE_REPORT);
    expect(report.fetch()).to.deep.eq({
      '2/one': {one: '2/one', two: '2/two', three: '2/three'},
      '3/one': {one: '3/one', two: '3/two', three: '3/three'},
    });
  });

  it('Errors when multiple CIDs are set with no login customer ID', function () {
    const multiFactory = new ReportFactory(apiFactory, {
      customerIds: '1,2,3,4,5',
      label: 'test',
    });

    expect(() => multiFactory.create(FAKE_REPORT)).to.throw(
      'Please provide a single login customer ID for multiple CIDs.',
    );
  });

  it('Infers all login customer IDs when none is set', function () {
    const multiFactory = new ReportFactory(apiFactory, {
      loginCustomerId: '1',
      customerIds: '2,3',
      label: 'test',
    });
    const report = multiFactory.create(FAKE_REPORT);

    expect(report.fetch()).to.deep.eq({
      '2/one': {one: '2/one', two: '2/two', three: '2/three'},
      '3/one': {one: '3/one', two: '3/two', three: '3/three'},
    });
  });
});

describe('Join Report', function () {
  let reportFactory: ReportFactory;
  let mockQuery: sinon.SinonStub;
  let stubs: sinon.SinonStub[];

  beforeEach(function () {
    ({reportFactory, mockQuery, stubs} = bootstrapGoogleAdsApi());
  });

  afterEach(function () {
    tearDownStubs(stubs);
  });

  it('returns expected results from query', function () {
    mockQuery.callsFake(({query}) => {
      if (query === JOIN_REPORT.query) {
        return iterator({d: {one: 'one', nother: 'another'}}, {d: {one: '1'}});
      } else if (query === GET_LEAF_ACCOUNTS_REPORT.query) {
        return iterator({
          customerClient: {id: '1'},
        });
      } else {
        return iterator({
          a: {one: 'one'},
          b: {two: 'two'},
          c: {another: 'three'},
        });
      }
    });
    const report = reportFactory.create(JOIN_REPORT);
    expect(report.fetch()).to.deep.eq({
      one: {one: 'one', two: 'two', another: 'another'},
    });
  });
});

describe('Join query handling', function () {
  let reportFactory: ReportFactory;
  let api: GoogleAdsApi;
  let stubs: sinon.SinonStub[];
  const qlifyStack: string[] = [];

  beforeEach(function () {
    ({reportFactory, api, stubs} = bootstrapGoogleAdsApi());
    const qlifyQuery = api.qlifyQuery;
    stubs.push(
      sinon.stub(api, 'qlifyQuery').callsFake((query, queryWheres) => {
        const aql = qlifyQuery(query, queryWheres);
        qlifyStack.push(aql);
        return aql;
      }),
    );
    mockAppsScript();
    stubs.push(
      sinon.stub(UrlFetchApp, 'fetch').callsFake((_, request) => {
        const payload = JSON.parse(request.payload as string) as {
          query: string;
        };
        if (payload.query === 'SELECT d.one, d.nother FROM the_main_table') {
          return {
            getContentText() {
              return JSON.stringify({
                results: [
                  {d: {one: '1', nother: 'another'}},
                  {d: {one: '11', nother: 'yet another'}},
                  // this value doesn't exist - but should still be queried.
                  {d: {one: '111', nother: 'yet another'}},
                ],
              });
            },
          } as HTTPResponse;
        }
        const joinedPayload = {
          results: [
            {
              a: {one: '1'},
              b: {two: '2'},
              c: {three: '3'},
            },
            {
              a: {one: '11'},
              b: {two: '22'},
              c: {three: '3'},
            },
          ],
        };
        return {
          getContentText() {
            return JSON.stringify(joinedPayload);
          },
        } as HTTPResponse;
      }),
    );
  });

  afterEach(function () {
    tearDownStubs(stubs);
  });

  it('joins on IDs that exist', function () {
    const report = reportFactory.create(JOIN_REPORT);
    report.fetch();
    expect(qlifyStack.pop()).to.equal(
      'SELECT a.one, b.two, c.three FROM something WHERE something.id IN (1,11,111)',
    );
  });
});

describe('Leaf expansion', function () {
  let reportFactory: ReportFactory;
  let mockQuery: sinon.SinonStub;
  let stubs: sinon.SinonStub[];
  const mockLeafAccounts: Record<string, string[]> = {'123': ['1', '2', '3']};

  beforeEach(function () {
    ({reportFactory, mockQuery, stubs} = bootstrapGoogleAdsApi({
      mockLeafAccounts,
      spyOnLeaf: false,
    }));
  });

  afterEach(function () {
    tearDownStubs(stubs);
  });

  it('checks all expanded accounts are added to the report', function () {
    mockQuery.callsFake(({customerId, query}) => {
      if (query === GET_LEAF_ACCOUNTS_REPORT.query) {
        return iterator(
          ...mockLeafAccounts[customerId].map((id) => ({
            customerClient: {id, name: `customer ${id}`, status: 'ENABLED'},
          })),
        );
      } else {
        return iterator({
          customerId,
          a: {id: customerId},
        });
      }
    });
    const report = reportFactory.create(FAKE_REPORT_2);
    expect(report.fetch()).to.deep.include({
      'customers/1/id/a1': {customerId: '1', id: 'a1'},
      'customers/2/id/a2': {customerId: '2', id: 'a2'},
      'customers/3/id/a3': {customerId: '3', id: 'a3'},
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
