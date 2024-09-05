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
 * @fileoverview Contains helpers for testing the DBM.
 *
 */

import { DBM_API_VERSION, DBM_URL } from '../api';

interface Params {
  [parameter: string]: unknown;
}

interface MatchTableQueries {
  [url: string]: {
    get?: () => string;
    post?: (params: Params) => string;
  };
}

interface Query {
  queryId: string;
  metadata: {
    title: string;
  };
}

/**
 * A mocked FetchApp used to grab a static response from a `MatchTable`.
 */
class MockUrlFetchApp {
  constructor(private readonly matches: MatchTableQueries) {}

  fetch(url: string, params: Params) {
    if (!params) {
      throw new Error('Missing header values!');
    }
    if (!params['payload']) {
      return {
        getContentText: () => {
          if (this.matches[url] === undefined) {
            throw new Error(`Cannot find a method matching GET ${url}`);
          }
          return (this.matches[url].get as () => string)();
        },
      };
    }

    return {
      getContentText: () => {
        if (
          this.matches[url] === undefined ||
          this.matches[url].post === undefined
        ) {
          throw new Error(`Cannot find a method matching POST ${url}`);
        }
        return (this.matches[url].post as (params: Params) => string)(params);
      },
    };
  }
}

function getUrl(uri: string) {
  return `https://${DBM_URL}/${DBM_API_VERSION}/${uri}`;
}

/**
 * Represents a mocked match on a DBM API hit.
 *
 * This isn't testing the query functionality, so it just mocks that and is
 * extensible to make it easy to test different return types.
 */
abstract class MatchTable {
  private queryPostHits = 0;
  private queryGetHits = 0;
  private runPostHits = 0;
  private currentQuery = 0;
  private readonly routes: MatchTableQueries;
  private readonly storedQueries: Query[] = [];
  protected reportGetHits = 0;

  constructor(overrides: MatchTableQueries = {}) {
    this.routes = {
      [getUrl('queries')]: {
        post: this.createQuery.bind(this),
        get: this.listQueries.bind(this),
      },
      [getUrl('queries/query1:run?synchronous=true')]: {
        post: this.postRun.bind(this),
      },
      [getUrl('queries/query2:run?synchronous=true')]: {
        post: this.postRun2.bind(this),
      },
      'https://path/to/report': {
        get: this.getReport.bind(this),
      },
    };
    for (const [path, methods] of Object.entries(overrides)) {
      if (methods.get) {
        this.routes[path].get = methods.get;
      }
      if (methods.post) {
        this.routes[path].post = methods.post;
      }
    }
    // tslint:disable-next-line:enforce-name-casing This is to mock existing variables.
    (globalThis as unknown as { UrlFetchApp: MockUrlFetchApp }).UrlFetchApp =
      new MockUrlFetchApp(Object.assign({}, this.routes));
  }

  getHits() {
    return {
      queryGetHits: this.queryGetHits,
      queryPostHits: this.queryPostHits,
      runPostHits: this.runPostHits,
      reportGetHits: this.reportGetHits,
    };
  }

  /** Simulate a query being added to DV360. */
  addQuery(query: Query) {
    this.storedQueries.push(query);
  }

  private postRun(params: Params, key = '') {
    ++this.runPostHits;
    return JSON.stringify({
      metadata: {
        googleCloudStoragePath: `https://path/to/report${key}`,
      },
    });
  }

  private postRun2(params: Params) {
    return this.postRun(params, '2');
  }

  protected createQuery(params: Params) {
    ++this.queryPostHits;
    const payload = params['payload'] as string;
    const title = (JSON.parse(payload) as Query).metadata.title;
    const query: Query = {
      queryId: `query${++this.currentQuery}`,
      metadata: {
        title,
      },
    };
    this.storedQueries.push(query);
    return JSON.stringify(query);
  }

  private listQueries() {
    ++this.queryGetHits;
    return JSON.stringify({
      queries: this.storedQueries,
    });
  }

  protected abstract getReport(): string;
}

/**
 * simplified api calls for testing integration with budgets.
 *
 * this is using static definitions where sensible because we generally want to
 * test the output rather than the way our dao interacts with the api.
 */
export class BudgetMatchTable extends MatchTable {
  protected override getReport() {
    ++this.reportGetHits;
    return (
      'Campaign ID,Insertion Order ID,Budget Segment Start Date,Budget Segment End Date,Billable Cost (Advertiser Currency)\n' +
      '1,IO2,2022/12/17,2022/12/27,0.020020\n' +
      '1,IO3,2022/12/17,2022/12/27,0.030030\n' +
      '1,IO4,2022/12/17,2022/12/27,0.040040\n' +
      '2,IO5,2022/12/17,2022/12/27,0.050050\n' +
      '\n' +
      'Report Time:Sometime\n' +
      'Date Range:The range of time'
    );
  }
}

/**
 * Simplified api calls for testing integration with impressions.
 */
export class ImpressionMatchTable extends MatchTable {
  protected override getReport() {
    return (
      'Country,Insertion Order ID,Billable Impressions\n' +
      'US,1,1.00\n' +
      'UK,1,1.00\n' +
      'IT,1,8.00\n' +
      'CN,1,4.00\n' +
      'US,2,1.00\n' +
      'UK,2,1.00\n' +
      'IT,2,8.00\n' +
      'CN,2,4.00\n' +
      ',,28.00\n' +
      '\n' +
      'Report Time:,2022/12/10 03:34 GMT\n' +
      'Date Range:,2022/09/04 to 2022/10/30\n' +
      'Group By:,Region\n' +
      'MRC Accredited Metrics,Active View metrics are accredited only when Measurement Source = Measured\n' +
      '"Reporting numbers from the previous month are finalized (for billing purposes) on the first of each month, unless communicated otherwise. Some numbers in reports may fluctuate for up to seven days before matching billing numbers."\n'
    );
  }
}
