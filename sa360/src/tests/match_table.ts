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

// g3-format-prettier

import {
  SA360_API_VERSION,
  SA360_URL,
} from 'sa360/src/api';

interface Params {
  payload: string;
  headers: {[key: string]: string};
}

class FakeScriptApp {
  getOAuthToken() {
    return 'token';
  }
}

class FakeUtilities {
  parseCsv(text: string) {
    // We don't need a special package because this test CSV is very
    // basic. No escaping, etc.
    const lines = text.split('\n').map((line: string) => line.split(','));
    return lines;
  }
}

/**
 * Mock some extra stuff.
 *
 * Exported as a function in addition to getting immediately called, in case
 * it gets overwritten.
 */
export function moreMocks() {
  // tslint:disable-next-line:enforce-name-casing This is to mock existing variables.
  (globalThis as unknown as {ScriptApp: FakeScriptApp}).ScriptApp =
    new FakeScriptApp();
  // tslint:disable-next-line:enforce-name-casing This is to mock existing variables.
  (globalThis as unknown as {Utilities: FakeUtilities}).Utilities =
    new FakeUtilities();
}

moreMocks();

interface MatchTableQueries {
  [url: string]: {
    get?: (params: Params) => string;
    post?: (params: Params) => string;
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
    if (!params.payload) {
      return {
        getContentText: () => {
          if (this.matches[url] === undefined) {
            throw new Error(`Cannot find a method matching GET ${url}`);
          }
          return (this.matches[url].get as (params: Params) => string)(params);
        },
      };
    }

    return {
      getContentText: () => {
        if (this.matches[url].post === undefined) {
          throw new Error(`Cannot find a method matching POST ${url}`);
        }
        return (this.matches[url].post as (params: Params) => string)(params);
      },
    };
  }
}

/**
 * Simplified API calls for testing integration.
 *
 * This is using static definitions where sensible because we generally want to
 * test the output rather than the way our DAO interacts with the API.
 */
export class MatchTable {
  private queryPostHits = 0;
  private runPostHits = 0;
  private reportGetHits = 0;
  private readonly routes: MatchTableQueries;
  private params!: Params;

  private getRoutes(): MatchTableQueries {
    return {
      [this.getUrl('reports')]: {
        post: this.createQuery.bind(this),
      },
      [this.getUrl('reports/1')]: {
        get: this.listResults.bind(this),
      },
      'https://path/to/report': {
        get: this.getReport.bind(this),
      },
    };
  }

  constructor(overrides: MatchTableQueries = {}) {
    this.routes = this.getRoutes();

    for (const [path, methods] of Object.entries(overrides)) {
      if (methods.get) {
        this.routes[path].get = methods.get;
      }
      if (methods.post) {
        this.routes[path].post = methods.post;
      }
    }
    // tslint:disable-next-line:enforce-name-casing This is to mock existing variables.
    (globalThis as unknown as {UrlFetchApp: MockUrlFetchApp}).UrlFetchApp =
      new MockUrlFetchApp(Object.assign({}, this.routes));
  }

  getHits() {
    return {
      queryPostHits: this.queryPostHits,
      runPostHits: this.runPostHits,
      reportGetHits: this.reportGetHits,
    };
  }

  private listResults() {
    ++this.runPostHits;
    const obj = {
      'url': 'https://path/to/report',
      byteCount: new Blob([this.getReport(this.params)]).size,
    };
    const a = JSON.stringify({
      'isReportReady': true,
      'files': [obj],
    });
    return a;
  }

  private createQuery(params: Params) {
    ++this.queryPostHits;
    this.params = params;
    return JSON.stringify({
      id: '1',
    });
  }

  private getAdGroupReport() {
    const payload = JSON.parse(this.params.payload) as {
      columns: Array<{columnName: string}>;
      reportScope: {agencyId: string};
    };
    const columns = payload.columns;
    const agencyId2 = payload.reportScope.agencyId === '2';
    function fill() {
      return Array.from({length: columns.length}).map((v) => '');
    }

    const matrix: string[][] = [fill()];

    for (const [j, column] of columns.entries()) {
      matrix[0][j] = column.columnName;
      for (let i = 0; i < 4; i++) {
        const headers = [
          'agency',
          'agencyId',
          'advertiser',
          'advertiserId',
          'adGroupId',
        ];
        for (let h = 0; h < headers.length; h++) {
          (matrix[i + 1] ??= fill())[h] = `${headers[h]}1`;
          if (agencyId2) {
            (matrix[i + 5] ??= fill())[h] = `${headers[h]}${
              headers[h] === 'adGroupId' ? 1 : 2
            }`;
          }
        }
        if (
          (i + 1) * 6 === j ||
          (i + 1) * 6 + 1 === j ||
          (i + 1) * 6 + 2 === j
        ) {
          matrix[i + 1][j] = `${column.columnName}1`;
          if (agencyId2) {
            matrix[i + 5][j] = `${column.columnName}2`;
          }
        }
      }
    }

    return matrix;
  }

  private getDefaultReport() {
    const columns = (
      JSON.parse(this.params.payload) as {columns: Array<{columnName: string}>}
    ).columns;

    const matrix: string[][] = [[]];
    for (const column of columns) {
      matrix[0].push(column.columnName);
      (matrix[1] ??= []).push(`${column.columnName}1`);
      (matrix[2] ??= []).push(`${column.columnName}2`);
    }

    return matrix;
  }

  private getReport(params: Params) {
    ++this.reportGetHits;
    const matrix =
      (JSON.parse(this.params.payload) as {reportType: 'adGroupTarget'})
        .reportType === 'adGroupTarget'
        ? this.getAdGroupReport()
        : this.getDefaultReport();
    const [start, end] = params.headers['Range']
      ? params.headers['Range'].split('bytes=')[1].split('-').map(Number)
      : [null, null];

    const text =
      matrix.reduce((prevRow, row) => {
        if (prevRow) {
          prevRow += '\n';
        }

        return (
          prevRow +
          row.reduce((prevContent, col) => {
            if (prevContent) {
              prevContent += ',';
            }
            return prevContent + col;
          }, '')
        );
      }, '') + '\n';

    if (start !== null && end !== null && text.length >= end - 1) {
      return text.slice(start, end + 1);
    }
    return text;
  }

  getUrl(uri: string) {
    return `https://${SA360_URL}/${SA360_API_VERSION}/${uri}`;
  }
}
