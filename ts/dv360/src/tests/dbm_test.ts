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

import {mockAppsScript} from 'common/test_helpers/mock_apps_script';

import {BudgetReport, ImpressionReport} from '../api';
import {IDType} from '../types';

import {BudgetMatchTable, ImpressionMatchTable} from './dbm_test_helpers';
import {expect} from 'chai';

class FakeScriptApp {
  getOAuthToken() {
    return 'token';
  }
}

// tslint:disable-next-line:enforce-name-casing This is to mock existing variables.
(globalThis as unknown as {ScriptApp: FakeScriptApp}).ScriptApp =
  new FakeScriptApp();

describe('BudgetReport#getSpendForInsertionOrder', function () {
  let router: BudgetMatchTable;

  beforeEach(function () {
    mockAppsScript();
    // tslint:disable-next-line:no-unused-expression
    router = new BudgetMatchTable();
  });
  // assuming that the API request/responses are sane (these are tested separately)
  // we want to make sure that we get a result from the series of API calls
  // made.
  it('passes integration.', function () {
    const advertiserId = '1';
    // note - these aren't testing anything right now.
    const startDate = new Date('2022/12/17');
    const endDate = new Date('2022/12/27');

    const result = new BudgetReport({
      id: advertiserId,
      idType: IDType.ADVERTISER,
      startDate,
      endDate,
    }).getSpendForInsertionOrder('IO2', startDate.getTime(), endDate.getTime());
    expect(result).to.eql(0.02002);
  });

  it('only pulls report once.', function () {
    const advertiserId = '1';
    // note - these aren't testing anything right now.
    const startDate = new Date('2022/12/17');
    const endDate = new Date('2022/12/27');
    const budgetReport = new BudgetReport({
      id: advertiserId,
      idType: IDType.ADVERTISER,
      startDate,
      endDate,
    });
    budgetReport.getSpendForInsertionOrder(
      'IO2',
      startDate.getTime(),
      endDate.getTime(),
    );
    const hits1 = {...router.getHits()};
    const result2 = budgetReport.getSpendForInsertionOrder(
      'IO3',
      startDate.getTime(),
      endDate.getTime(),
    );
    const hits2 = {...router.getHits()};

    expect(hits1).to.eql({
      queryPostHits: 1,
      queryGetHits: 1,
      runPostHits: 1,
      reportGetHits: 1,
    });
    expect(hits2).to.eql(hits1);
    expect(result2).to.eql(0.03003);
  });
});

describe('ImpressionReport#getImpressionPercentOutsideOfGeos', function () {
  beforeEach(function () {
    mockAppsScript();
    // tslint:disable-next-line:no-unused-expression
    new ImpressionMatchTable();
  });
  // assuming that the API request/responses are sane (these are tested separately)
  // we want to make sure that we get a result from the series of API calls
  // made.
  it('passes integration.', function () {
    const advertiserId = '1';
    // note - these aren't testing anything right now.
    const startDate = new Date('2022/12/17');
    const endDate = new Date('2022/12/27');

    const result = new ImpressionReport({
      id: advertiserId,
      idType: IDType.ADVERTISER,
      startDate,
      endDate,
    }).getImpressionPercentOutsideOfGeos('1', ['US', 'UK']);
    expect(result).to.eql(12 / 14);
  });

  it('handles empty results', function () {
    const advertiserId = '1';
    // note - these aren't testing anything right now.
    const startDate = new Date('2022/12/17');
    const endDate = new Date('2022/12/27');

    const result = new ImpressionReport({
      id: advertiserId,
      idType: IDType.ADVERTISER,
      startDate,
      endDate,
    }).getImpressionPercentOutsideOfGeos('1', ['US', 'UK', 'IT', 'CN']);
    expect(result).to.eql(0);
  });
});

// Contains branching logic. Testing this separately from integration test.
describe('BudgetReport#fetchQueryId()', function () {
  let router: BudgetMatchTable;

  beforeEach(function () {
    mockAppsScript();
    router = new BudgetMatchTable();
  });

  it('returns a query ID from creation', function () {
    const budgetReport = new BudgetReport({
      id: '1',
      idType: IDType.ADVERTISER,
      startDate: new Date(1, 0, 1),
      endDate: new Date(1, 1, 2),
    });
    expect(budgetReport.fetchQueryId()).to.eql('query1');
    expect(router.getHits().queryPostHits).to.eql(1);
  });

  it('returns a query ID from cache', function () {
    const budgetReport = new BudgetReport({
      id: '1',
      idType: IDType.ADVERTISER,
      startDate: new Date(1, 0, 1),
      endDate: new Date(1, 1, 2),
    });
    const queryResult1 = budgetReport.fetchQueryId();
    const hits1 = router.getHits();
    // second time - reads from PropertiesService
    const queryResult2 = budgetReport.fetchQueryId();
    const hits2 = router.getHits();

    expect(queryResult1).to.eql('query1');
    expect(queryResult2).to.eql('query1');
    expect(hits1).to.eql({
      queryPostHits: 1,
      queryGetHits: 1,
      runPostHits: 1,
      reportGetHits: 1,
    });
    expect(hits2).to.eql({
      queryPostHits: 1,
      queryGetHits: 1,
      runPostHits: 1,
      reportGetHits: 1,
    });
  });

  it('returns a query ID from list, matched by title', function () {
    const budgetReport = new BudgetReport({
      id: '1',
      idType: IDType.ADVERTISER,
      startDate: new Date(1, 0, 1),
      endDate: new Date(1, 1, 2),
    });
    router.addQuery({
      queryId: 'query1',
      metadata: {
        title: 'Launch Monitor V1 (Spend) A1',
      },
    });

    expect(budgetReport.fetchQueryId()).to.eql('query1');
    expect(router.getHits()).to.eql({
      queryPostHits: 1,
      queryGetHits: 1,
      runPostHits: 1,
      reportGetHits: 1,
    });
  });

  it('correctly skips cache on new query', function () {
    const budgetReport1 = new BudgetReport({
      id: '1',
      idType: IDType.ADVERTISER,
      startDate: new Date(1, 0, 1),
      endDate: new Date(1, 1, 2),
    });
    budgetReport1.fetchQueryId();
    const hits1 = {...router.getHits()};
    const budgetReport2 = new BudgetReport({
      id: '1',
      idType: IDType.ADVERTISER,
      startDate: new Date(1, 0, 1),
      endDate: new Date(1, 1, 2),
    });
    budgetReport2.fetchQueryId();
    const hits2 = {...router.getHits()};

    expect(budgetReport1.fetchQueryId()).to.eql('query1');
    expect(budgetReport2.fetchQueryId()).to.eql('query1');
    expect(hits1).to.eql({
      queryPostHits: 1,
      queryGetHits: 1,
      runPostHits: 1,
      reportGetHits: 1,
    });
    expect(hits2).to.eql({
      queryPostHits: 1,
      queryGetHits: 1,
      runPostHits: 1,
      reportGetHits: 2,
    });
  });
});
