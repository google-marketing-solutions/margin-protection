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

import {RecordInfo} from 'common/types';
import {ClientArgs} from './types';
import Payload = GoogleAppsScript.URL_Fetch.Payload;
import {HELPERS} from 'common/sheet_helpers';
import {SearchAdsTimeRange} from 'sa360/src/types';

/**
 * The API version, exposed for testing.
 */
export const SA360_API_VERSION = 'v2';

/**
 * The API URL, exposed for testing.
 */
export const SA360_URL = 'www.googleapis.com/doubleclicksearch';

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = ONE_HOUR * 24;

/**
 * Campaign report columns.
 */
export const campaignColumns = [
  'agency', 'agencyId', 'advertiser', 'advertiserId', 'campaignId', 'campaign',
  'campaignStatus'
] as const;

/**
 * Ad Group report columns.
 */
export const adGroupColumns = [
  'agency', 'agencyId', 'advertiser', 'advertiserId', 'campaignId',
  'adGroupId', 'adGroup', 'adGroupStatus'
] as const;

export const adGroupTargetColumns = [
  'agency', 'agencyId', 'advertiser', 'advertiserId', 'adGroupId',
  'campaignId', 'genderTargetGenderType', 'ageTargetAgeRange',
  'engineRemarketingList',
] as const;

export const campaignTargetColumns = [
  'agency', 'agencyId', 'advertiser', 'advertiserId', 'campaignId',
  'locationTargetName',
] as const;

type AllowedColumns = typeof campaignColumns | typeof adGroupColumns | typeof adGroupTargetColumns | typeof campaignTargetColumns;

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
  fullFetch?: boolean;
}

class Report<T extends AllowedColumns> {
  protected constructor(readonly report:
                            {[campaignId: string]: ReportRecord<T>}) {}

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
 * SA360 Ad group-based report.
 */
export class AdGroupReport extends Report<typeof adGroupColumns> {
  static async buildReport(params: ClientArgs) {
    const builder = new AdGroupReportBuilder(params);
    return new AdGroupReport(await builder.build());
  }

  getAdGroups(): RecordInfo[] {
    const foundAdGroupIds = new Set<string>();
    return Object.values(this.report).reduce((prev, reportRecord) => {
      if (reportRecord.adGroupId in foundAdGroupIds) {
        return prev;
      }
      foundAdGroupIds.add(reportRecord.adGroupId);
      prev.push({id: reportRecord.adGroupId, advertiserId: reportRecord.advertiserId, displayName: reportRecord.adGroup});
      return prev;
    }, [] as RecordInfo[]);
  }
}

/**
 * SA360 Ad-group targets checker.
 *
 * This classes not contain the typical report data, and `report` will be empty.
 * Instead, use `adGroupMap` to get a map of ad group IDs to a set of age,
 * gender and remarketing target values and bid modifiers. These can be used to
 * measure change without any other context.
 */
export class AdGroupTargetReport extends Report<typeof adGroupTargetColumns> {
  static async buildReport(params: ClientArgs) {
    const builder = new AdGroupTargetReportBuilder(params);
    return new AdGroupTargetReport(await builder.build());
  }
}

/**
 * SA360 Campaign targets checker.
 *
 * This is used to check location targets, as ad group target reports do not
 * produce this information even though it's available.
 */
export class CampaignTargetReport extends Report<typeof campaignTargetColumns> {
  static async buildReport(params: ClientArgs) {
    const builder = new CampaignTargetReportBuilder(params);
    return new CampaignTargetReport(await builder.build());
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
    startDate?: string;
    endDate?: string;
  };
  operator: 'equals'|'greaterThan'|'lessThan';
  values: Array<string|number>;
}

/**
 * Classes that extend this are responsible for building an SA360 report.
 */
export abstract class ReportBuilder<Columns extends AllowedColumns> {
  static step = 10_000_000;

  constructor(protected readonly params: ApiParams) {}

  protected getFilters(): undefined | Filter[] {
    return;
  }

  getQueryUrl(uri: string) {
    return `https://${SA360_URL}/${SA360_API_VERSION}/${uri}`;
  }

  /**
   * Provides sensible defaults to build a `UrlFetchApp` params object.
   */
  apiParams({payload, contentType = 'application/json', headers={}}: {payload?: Payload, contentType?: string, headers?: {[key: string]: string}} = {}) {
    const token = ScriptApp.getOAuthToken();
    return {
      payload,
      contentType,
      headers:
          {'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...headers},
    };
  }

  async build() {
    for (let i = 0; i < 5; i++) {
      try {
        const id = this.fetchReportId();
        const reportUrls = await this.fetchReportUrl(id);
        const time = new Date().getTime();
        HELPERS.saveLastReportPull(time);
        return this.aggregateReports(reportUrls);
      } catch (e) {
        console.error(e);
        if (i + 2 <= 5) {
          console.info(`Trying again, attempt ${i + 2}/5`);
        }
      }
    }

    throw new Error('Failed to fetch a report after five tries.');
  }

  async fetchReportUrl(reportId: string): Promise<Array<{url: string, byteCount: string}>> {
    let response: {files: Array<{url: string, byteCount: string}>, isReportReady: boolean};

    return new Promise((resolve, fail) => {
      for (let i = 0; i < 4; i++) {
        const msecs = 1000 * 3 ** (i + 1);
        console.info(`sleeping for ${msecs/1000} seconds before fetching report...`);
        Utilities.sleep(msecs);
        response = JSON.parse(fetch(
                this.getQueryUrl(`reports/${reportId}`),
                this.apiParams())
            .getContentText()) as
            {files: Array<{url: string, byteCount: string}>, isReportReady: boolean};
        if (response.isReportReady) {
          console.info('done');
          resolve(response.files);
          return;
        }
        console.info('Report not ready.');
      }
      fail('Failed to get report');
    });
  }

  /**
   * Mutates a row in a report.
   *
   * This breakout method allows child classes to modify how a report is
   * aggregated, which is importnt for sparse reports like ad targeting.
   *
   * @param obj The value to mutate
   * @param id The ID to write or update based on {@link getKey}.
   * @param headers An array of headers.
   * @param columns An array of columns (index-matched to the headers).
   * @protected
   */
  protected mutateRow(
      obj: {[p: string]: ReportRecord<Columns>}, id: string, headers: string[],
      columns: string[]) {
    obj[id] = Object.fromEntries(
        columns.map((column, idx) => [headers[idx], column])) as Record<ColumnType<Columns>, string>;
  }

  /**
   * Reads a report in one or more batches of bytes.
   *
   * Reports can easily exhaust memory, so they are read in chunks and
   * concatenated together to make things easier.
   */
  aggregateReports(urls: Array<{url: string, byteCount: string}>) {
    const reports = urls.reduce((prev, {url, byteCount}) => {
      const byteCountInt = Number(byteCount);
      let partialRow: string = '';
      let headers: Array<ColumnType<Columns>> | undefined;
      const batches = Math.ceil(Number(byteCountInt) / ReportBuilder.step);
      for (let i = 0; i < batches; i++) {
        console.log(`getting data from URL: ${i+1}/${batches}`);
        const report =
            fetch(url, this.apiParams({
              contentType: 'text/plain',
              headers: {
                'Range': `bytes=${ReportBuilder.step * i}-${Math.min(byteCountInt, ReportBuilder.step * (i + 1)) - 1}`
              }
            }))
                .getContentText()
                .split('\n');
        // get the last row which will be blank at the end of the file.

        report[0] = partialRow + (report[0] ?? '');
        partialRow = report.pop() as string;
        if (!report.length) {
          report[0] = partialRow;
          continue;
        }
        if (!headers) {
          headers = report.shift()!.split(',') as Array<ColumnType<Columns>>;
        }

        const indexMap = Object.fromEntries(headers.map(
            (columnName, idx) => [columnName, idx])) as
            {[Property in ColumnType<Columns>]: number};
        for (const row of report) {
          const columns: string[] = row.split(',');
          const id = columns[this.getKey(indexMap)];
          this.mutateRow(prev, id, headers, columns);
        }
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
    const filters = this.getFilters() ?? [];
    const payload = JSON.stringify({
      reportScope: {
        agencyId: this.params.agencyId,
        ...advertiserId,
      },
      reportType: this.getReportType(),
      columns: this.getColumns().map(columnName => ({columnName})),
      statisticsCurrency: 'agency',
      ...{ timeRange: this.getTimeRange() },
      maxRowsPerFile: 100_000_000,
      downloadFormat: 'csv',
      ...{filters},
    });
    const response =
        JSON.parse(
            fetch(this.getQueryUrl('reports'), this.apiParams({payload}))
                .getContentText()) as {id: string, byteCount: number};
    return response.id;
  }

  protected getTimeRange(): SearchAdsTimeRange {
    const time = HELPERS.getLastReportPull() || new Date().getTime() - ONE_DAY;

    if (!this.params.fullFetch) {
      return {
        changedAttributesSinceTimestamp:
            new Date(time - ONE_DAY).toISOString(),
      };
    } else {
      const date = new Date();
      const dateString = `${date.getFullYear()}-${date.getUTCMonth() + 1}-${date.getDate()}`;
      return {
        startDate: dateString,
        endDate: dateString,
      };
    }
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

class AdGroupReportBuilder extends ReportBuilder<typeof adGroupColumns> {
  protected override getKey(map: Record<ColumnType<typeof adGroupColumns>, number>): number {
    return map.adGroupId;
  }

  protected override getColumns(): typeof adGroupColumns {
    return adGroupColumns;
  }

  protected override getReportType(): string{
    return 'adGroup';
  }

  protected override getFilters() {
    return [
      {
        column: { columnName: 'campaignStatus' },
        operator: 'equals' as const,
        values: ['Active'],
      }
    ]
  }
}

class AdGroupTargetReportBuilder extends
    ReportBuilder<typeof adGroupTargetColumns> {
  protected override getKey(
      map: Record<ColumnType<typeof adGroupTargetColumns>, number>): number {
    return map.adGroupId;
  }

  protected override getColumns() {
    return adGroupTargetColumns;
  }

  protected override getReportType() {
    return 'adGroupTarget';
  }

  protected override getFilters() {
    return [
      {
        column: { columnName: 'campaignStatus' },
        operator: 'equals' as const,
        values: ['Active'],
      }
    ]
  }

  protected override mutateRow(
      obj: {[p: string]: ReportRecord<typeof adGroupTargetColumns>}, id: string,
      headers: string[], columns: string[]) {
    const {row, filteredColumns} = getFilteredColumns(obj, id, headers, columns);
    for (const [i, column] of filteredColumns) {
      if (['advertiserId', 'advertiser', 'agencyId', 'agency', 'adGroupId', 'campaignId'].indexOf(headers[i]) >=
          0) {
        row[headers[i]] = column;
        continue;
      }
      row[headers[i]] = row[headers[i]] === undefined ? column :
          `${row[headers[i]]},${column}`;
    }
  }
}

/**
 * Builds a campaign target report.
 *
 * Exposed for testing. Otherwise, use {@link CampaignTargetReport.buildReport}.
 */
export class CampaignTargetReportBuilder extends ReportBuilder<typeof campaignTargetColumns> {
  protected getColumns(): typeof campaignTargetColumns {
    return campaignTargetColumns;
  }

  protected getKey(map: Record<ColumnType<typeof campaignTargetColumns>, number>): number {
    return map.campaignId;
  }

  protected getReportType(): string {
    return 'campaignTarget';
  }

  protected override mutateRow(
      obj: {[p: string]: ReportRecord<typeof campaignTargetColumns>}, id: string,
      headers: string[], columns: string[]) {
    const {row, filteredColumns} = getFilteredColumns(obj, id, headers, columns);
    for (const [i, column] of filteredColumns) {
      if (['advertiserId', 'advertiser', 'agencyId', 'agency', 'campaignId'].indexOf(headers[i]) >=
          0) {
        row[headers[i]] = column;
        continue;
      }
      row[headers[i]] = row[headers[i]] === undefined ? column :
          `${row[headers[i]]},${column}`;
    }
  }
}

function getFilteredColumns(obj: { [p: string]: Record<string, string> }, id: string, headers: string[], columns: string[]) {
  const row = (obj[id] = obj[id] ||
      Object.fromEntries(headers.map(header => [header, undefined]))) as
      Record<string, string|undefined>;
  const filteredColumns =
      columns.map<[number, string]>((c, j) => [j, c]).filter(c => c[1]);
  return {row, filteredColumns};
}

function fetch(url: string, params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions) {
  console.log(`fetching ${url}`);
  return UrlFetchApp.fetch(url, params);
}
