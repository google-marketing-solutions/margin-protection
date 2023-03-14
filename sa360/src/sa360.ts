/**
 * @license
 * Copyright 2023 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** @fileoverview DAO for the SA360 Reporting API */

/**
 * The API version, exposed for testing.
 */
export const SA360_API_VERSION = 'v2';

/**
 * The API URL, exposed for testing.
 */
export const SA360_URL = 'www.googleapis.com/doubleclicksearch';
const indexes = ['account', 'accountId', 'advertiserId', 'campaignId', 'campaign', 'campaignStatus', 'clicks', 'cost', 'impr', 'ctr', 'adWordsConversions', 'adWordsConversionValue', 'dailyBudget', 'monthlyBudget', 'effectiveBidStrategy'] as const;

interface ApiParams {
  agencyId: string;
  advertiserId?: string;
}

/**
 * SA360 campaign-based report.
 */
export class CampaignReport {
  private constructor(readonly report: {[campaignId: string]: {[key: string]: string}}) {
  }

  static async buildReport(params: {agencyId: string, advertiserId?: string}) {
    const builder = new CampaignReportBuilder(params);
    return new CampaignReport(await builder.build());
  }
}

class CampaignReportBuilder {
  constructor(private readonly params: ApiParams) {}

  getQueryUrl(uri: string) {
    return `https://${SA360_URL}/${SA360_API_VERSION}/${uri}`;
  }

  /**
   * Provides sensible defaults to build a `UrlFetchApp` params object.
   */
  apiParams(requestParams?: {payload: unknown}) {
    const token = ScriptApp.getOAuthToken();
    const baseParams = {
      'contentType': 'application/json',
      'headers':
          {'Authorization': `Bearer ${token}`, 'Accept': 'application/json'},
    };
    return Object.assign({}, baseParams, requestParams || {});
  }

  fetchReportId() {
    const advertiserId =
        this.params.advertiserId ? {advertiserId: this.params.advertiserId} : {};
    const payload = {
      reportScope: {
        agencyId: this.params.agencyId,
        ...{
          advertiserId
        }
      },
      reportType: 'campaign',
      columns: indexes.map(columnName => ({columnName})),
      statisticsCurrency: 'agency',
      timeRange: {startDate: '2022-10-01', endDate: '2022-10-31'},
      maxRowsPerFile: 100_000_000,
      downloadFormat: 'csv'
    };
    const response =
        JSON.parse(
            UrlFetchApp.fetch(this.getQueryUrl('reports'), this.apiParams({payload}))
                .getContentText()) as {id: string};
    return response.id;
  }

  async build() {
    const queryId = this.fetchReportId();
    const reportUrls = await this.fetchReportUrl(queryId);
    return this.aggregateReports(reportUrls);
  }

  async fetchReportUrl(reportId: string): Promise<string[]> {
    let response: {files: Array<{url: string}>, isReportReady: boolean};

    return new Promise<string[]>((resolve) => {
      const interval = setInterval(() => {
        response =
            JSON.parse(UrlFetchApp.fetch(this.getQueryUrl(`reports/${reportId}`), this.apiParams())
                           .getContentText()) as
            {files: Array<{url: string}>, isReportReady: boolean};
        if (response.isReportReady) {
          clearInterval(interval);
          resolve(response.files.map(file => file.url));
        }
      }, 1000);
    });
  }

  aggregateReports(urls: string[]) {
    const reports = urls.reduce((prev, url, idx) => {
      const report =
          UrlFetchApp.fetch(url, this.apiParams()).getContentText().split('\n');
      const headers = report[0].split(',');
      type IndexType = typeof indexes[number];
      const indexMap = Object.fromEntries(indexes.map(
                           (columnName, idx) => [columnName, idx])) as
          {[Property in IndexType]: number};
      for (const row of report.slice(1)) {
        const columns: string[] = row.split(',');
        const campaignId = columns[indexMap.campaignId];
        prev[campaignId] = Object.fromEntries(
            columns.map((column, idx) => [headers[idx], column]));
      }

      return prev;
    }, {} as {[campaignId: string]: {[key: string]: string}});

    return reports;
  }
}