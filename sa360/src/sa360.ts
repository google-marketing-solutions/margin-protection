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

/**
 * Ad Group report columns.
 */
export const adGroupColumns = [
  'account', 'accountId', 'advertiserId', 'campaignId', 'adGroupId', 'adGroup',
  'adGroupStatus',
] as const;

export const adGroupTargetColumns = [
  'adGroupId', 'adGroupTargetId', 'campaignId', 'genderTargetGenderType',
  'genderTargetBidModifier', 'ageTargetAgeRange', 'ageTargetBidModifier',
  'engineRemarketingList', 'engineRemarketingListBidModifier',
] as const;

export const campaignTargetColumns = [
  'campaignId', 'campaignTargetId', 'locationTargetName',
  'locationTargetBidModifier',
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
        const id = columns[this.getKey(indexMap)];
        this.mutateRow(prev, id, headers, columns);
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

  protected override getColumns(): typeof campaignColumns{
    return campaignColumns;
  }

  protected override getReportType(): string{
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
}

class AdGroupTargetReportBuilder  extends ReportBuilder<typeof adGroupTargetColumns> {
  protected override getKey(map: Record<ColumnType<typeof adGroupTargetColumns>, number>): number {
    return map.adGroupId;
  }

  protected override getColumns() {
    return adGroupTargetColumns;
  }

  protected override getReportType() {
    return 'adGroupTarget';
  }

  protected override mutateRow(
      obj: {[p: string]: ReportRecord<typeof adGroupTargetColumns>}, id: string,
      headers: string[], columns: string[]) {
    const {row, filteredColumns} = getFilteredColumns(obj, id, headers, columns);
    for (const [i, column] of filteredColumns) {
      if (['adGroupId', 'campaignId', 'adGroupTargetId'].indexOf(headers[i]) >=
          0) {
        row[headers[i]] = column;
        continue;
      }
      row[headers[i]] = row[headers[i]] === undefined ? `${row['adGroupTargetId']}:${column}` :
          `${row[headers[i]]},${row['adGroupTargetId']}:${column}`;
    }
  }
}

class CampaignTargetReportBuilder extends ReportBuilder<typeof campaignTargetColumns> {
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
      if (['campaignId', 'campaignTargetId'].indexOf(headers[i]) >=
          0) {
        row[headers[i]] = column;
        continue;
      }
      row[headers[i]] = row[headers[i]] === undefined ? `${row['campaignTargetId']}:${column}` :
          `${row[headers[i]]},${row['campaignTargetId']}:${column}`;
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

