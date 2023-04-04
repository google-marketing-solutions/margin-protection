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

import {RecordInfo} from '../../common/types';
import {ClientArgs} from './types';

/**
 * The API version, exposed for testing.
 */
export const SA360_API_VERSION = 'v2';

/**
 * The API URL, exposed for testing.
 */
export const SA360_URL = 'www.googleapis.com/doubleclicksearch';

/**
 * Campaign report columns.
 */
export const campaignColumns = [
  'account', 'accountId', 'advertiserId', 'campaignId', 'campaign',
  'campaignStatus', 'clicks', 'cost', 'impr', 'ctr', 'adWordsConversions',
  'adWordsConversionValue', 'dailyBudget', 'monthlyBudget',
  'effectiveBidStrategy'
] as const;

type AllowedColumns = typeof campaignColumns;

/**
 * Generic index type for object definitions of columns.
 */
export type ColumnType<Index extends AllowedColumns> = Index[number];

/**
 * A report record with defined members from {@link AllowedColumns}.
 */
export type ReportRecord<Index extends AllowedColumns> = {
  [Property in ColumnType<Index>]: string
};

interface ApiParams {
  agencyId: string;
  advertiserId?: string;
}

/**
 * SA360 campaign-based report.
 */
export class CampaignReport {
  protected constructor(readonly report:
                          {[campaignId: string]: ReportRecord<typeof campaignColumns>}) {}

  static async buildReport(params: ClientArgs) {
    const builder = new CampaignReportBuilder(params);
    return new CampaignReport(await builder.build());
  }

  getCampaigns(): RecordInfo[] {
    const foundCampaignIds = new Set<string>();
    return Object.values(this.report).reduce((prev, reportRecord) => {
      if (reportRecord.campaignId in foundCampaignIds) {
        return prev;
      }
      foundCampaignIds.add(reportRecord.campaignId);
      prev.push({id: reportRecord.campaignId, advertiserId: reportRecord.advertiserId, displayName: reportRecord.campaign});
      return prev;
    }, [] as RecordInfo[]);
  }
}

/**
 * The SA360 report filter type.
 *
 * This is a non-exhaustive list of options. For details, see
 * https://developers.google.com/search-ads/v2/reference/reports/generate
 */
interface Filter {
  column: {
    columnName: string;
  };
  operator: string;
  values: string[];
}

/**
 * Classes that extend this are responsible for building an SA360 report.
 */
abstract class ReportBuilder<Columns extends AllowedColumns> {
  constructor(protected readonly params: ApiParams) {}

  getFilters(): undefined | Filter[] {
    return;
  }

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

  async build() {
    const queryId = this.fetchReportId();
    const reportUrls = await this.fetchReportUrl(queryId);
    return this.aggregateReports(reportUrls);
  }

  async fetchReportUrl(reportId: string): Promise<string[]> {
    let response: {files: Array<{url: string}>, isReportReady: boolean};

    return new Promise<string[]>((resolve) => {
      const interval = setInterval(() => {
        response = JSON.parse(UrlFetchApp
            .fetch(
                this.getQueryUrl(`reports/${reportId}`),
                this.apiParams())
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
    const reports = urls.reduce((prev, url) => {
      const report =
          UrlFetchApp.fetch(url, this.apiParams()).getContentText().split('\n');
      const headers = report[0].split(',') as Array<ColumnType<Columns>>;
      const indexMap = Object.fromEntries(headers.map(
          (columnName, idx) => [columnName, idx])) as
          {[Property in ColumnType<Columns>]: number};
      for (const row of report.slice(1)) {
        const columns: string[] = row.split(',');
        const campaignId = columns[this.getKey(indexMap)];
        prev[campaignId] = Object.fromEntries(
            columns.map((column, idx) => [headers[idx], column])) as Record<ColumnType<Columns>, string>;
      }

      return prev;
    }, {} as {[campaignId: string]: ReportRecord<Columns>});

    return reports;
  }

  protected abstract getReportType(): string;

  protected abstract getColumns(): Columns;

  protected abstract getKey(map: Record<ColumnType<Columns>, number>): number;

  /**
   * Sends the initial request and returns a report ID.
   *
   * The report ID is used by {@link fetchReportUrl} to asynchronously poll
   * for the report until it's ready to be downloaded.
   */
  fetchReportId() {
    const advertiserId = this.params.advertiserId ?
        {advertiserId: this.params.advertiserId} :
        {};
    const filters = this.getFilters() ?? {};
    const payload = {
      reportScope: {
        agencyId: this.params.agencyId,
        ...{
          advertiserId
        }
      },
      reportType: this.getReportType(),
      columns: this.getColumns().map(columnName => ({columnName})),
      statisticsCurrency: 'agency',
      timeRange: {startDate: '2022-10-01', endDate: '2022-10-31'},
      maxRowsPerFile: 100_000_000,
      downloadFormat: 'csv',
      ...{filters},
    };
    const response =
        JSON.parse(
            UrlFetchApp
                .fetch(this.getQueryUrl('reports'), this.apiParams({payload}))
                .getContentText()) as {id: string};
    return response.id;
  }
}

class CampaignReportBuilder extends ReportBuilder<typeof campaignColumns> {
  protected override getKey(map: Record<ColumnType<typeof campaignColumns>, number>) {
    return map.campaignId;
  }

  protected override getColumns(): typeof campaignColumns {
    return campaignColumns;
  }

  protected override getReportType(): string {
    return 'campaign';
  }
}