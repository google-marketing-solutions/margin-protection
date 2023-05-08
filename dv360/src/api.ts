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

/**
 * @fileoverview Contains a DAO for DBM access.
 */


import {IDType, QueryReportParams} from './types';

/** The API version to use. Exposed for testing. */
export const DBM_API_VERSION = 'v2';
/** The URL of the API. Exposed for testing. */
export const DBM_URL = 'doubleclickbidmanager.googleapis.com';

const QUERY_VERSION = 'V1';
const REPORT_HEADER = `Launch Monitor ${QUERY_VERSION}`;

interface Query {
  queryId: Readonly<string>;
  metadata: {
    title: Readonly<string>;
  };
}

interface Report {
  key: {
    queryId: Readonly<string>;
    reportId: Readonly<string>;
  };
  metadata: {
    googleCloudStoragePath: Readonly<string>;
  };
}

interface QueryBody {
  metadata: {
    title: string;
    dataRange: {
      range: 'CUSTOM_DATES';
      customEndDate: {month: number; year: number; day: number};
      customStartDate: {month: number; year: number; day: number}
    } | {range: string};
    format: string;
    sendNotification: boolean;
  };
  params: {
    type: string;
    groupBys: readonly string[];
    metrics: readonly string[];
    filters: Array<{ type: string; value: string }>;
  };
}

abstract class Report {
  protected readonly properties: GoogleAppsScript.Properties.Properties;
  protected readonly report: Record<string, number>;
  abstract getReportName(): string;

  constructor(protected readonly params: QueryReportParams) {
    this.properties = PropertiesService.getScriptProperties();
    this.report = this.getReport();
  }

  protected abstract getReport(): Record<string, number>;

  /**
   * Get a query ID that matches the requested insertion order of this object.
   *
   * Either:
   *
   * (A) quickly gets the query ID stored in the `PropertiesService`.
   * (B) gets the query ID as stored in DBM.
   * (C) generates a new query.
   *
   * Ensures that the `PropertiesService` has an up-to-date queryID in the case
   * of (B) or (C).
   */
  fetchQueryId(): string {
    const queryTitle = this.getQueryTitle();
    const existingQueryId = this.properties.getProperty(queryTitle);
    if (existingQueryId) {
      return existingQueryId;
    }
    const query: Query = getExistingQueryByName(queryTitle) || JSON.parse(
        UrlFetchApp.fetch(
            getQueryUrl('queries'),
            apiParams({'payload': JSON.stringify(this.queryBody())}),
        ).getContentText()
    ) as Query;
    this.properties.setProperty(queryTitle, query.queryId);
    return query.queryId;
  }

  protected getQueryTitle() {
    return `${REPORT_HEADER} (${this.getReportName()}) ${this.params.idType === IDType.PARTNER ? 'P' : 'A'}${this.params.id}`;
  }

  /**
   * Fetches the report URL by query ID.
   *
   * Briefly caches the result to avoid unnecessary API calls.
   */
  protected fetchReportUrl(queryId: string): string {
    const reportUrl = CacheService.getScriptCache().get(`dbm-${queryId}`);
    if (reportUrl) {
      return reportUrl;
    }
    const query: Report = JSON.parse(
        UrlFetchApp.fetch(
            getQueryUrl(`queries/${queryId}:run?synchronous=true`),
            apiParams({
              'payload': JSON.stringify({
                dataRange: getDataRange(this.params.startDate, this.params.endDate),
              }),
            }),
        ).getContentText()
    ) as Report;
    const result = query.metadata.googleCloudStoragePath;
    CacheService.getScriptCache().put(`dbm-${queryId}`, result, 60);
    return result;
  }

  protected fetchReport(reportUrl: string): string[][] {
    const query: string = UrlFetchApp.fetch(
        reportUrl,
        apiParams({ 'contentType': undefined }),
    ).getContentText();

    return Utilities.parseCsv(query.split('\n\n')[0]);
  }

  protected abstract queryBody(): QueryBody;
}

export class ImpressionReport extends Report implements ImpressionReportInterface {
  override getReportName() {
    return 'Impressions';
  }

  getImpressionPercentOutsideOfGeos(insertionOrderId: string, countries: string[]) {
    const report = {...this.report};
    let validImpressions = 0;
    for (const country of countries) {
      const key = `${insertionOrderId},${country}`;
      validImpressions += report[key] ?? 0;
      delete report[key];
    }
    const invalidImpressions = Object.entries(report).reduce((prev, [key, val]) => {
      if (key.startsWith(insertionOrderId)) {
        prev += val;
      }
      return prev;
    }, 0);
    return invalidImpressions / (invalidImpressions + validImpressions) || 0;
  }

  protected override getReport() {
    const queryId = this.fetchQueryId();
    const reportUrl = this.fetchReportUrl(queryId);
    const report = this.fetchReport(reportUrl);

    const country = report[0].indexOf('Country');
    const insertionOrderId = report[0].indexOf('Insertion Order ID');
    const impressions = report[0].indexOf('Billable Impressions');
    const result: Record<string, number> = {};
    for (const reportLine of report.slice(1)) {
      if (!reportLine[insertionOrderId]) {
        continue;
      }
      const key = `${reportLine[insertionOrderId]},${reportLine[country]}`;
      result[key] = Number(reportLine[impressions]);
    }

    return result;
  }

  protected queryBody() {
    return {
      metadata: {
        title: this.getQueryTitle(),
        dataRange:  {
          // note - this is a placeholder. date range will always be overridden.
          'range': 'LAST_7_DAYS',
        },
        format: 'CSV',
        sendNotification: false,
      },
      params: {
        type: 'STANDARD',
        groupBys: [ 'FILTER_COUNTRY', 'FILTER_INSERTION_ORDER' ],
        metrics: [ 'METRIC_BILLABLE_IMPRESSIONS' ],
        filters: [
          {
            type: this.params.idType === IDType.PARTNER ? 'FILTER_PARTNER' : 'FILTER_ADVERTISER',
            value: String(this.params.id),
          },
        ],
      },
    };
  }
}

/**
 * Contains calls associated with getting a budget report.
 */
export class BudgetReport extends Report implements BudgetReportInterface {

  override getReportName() {
    return 'Spend';
  }

  /**
   * Provides the total spent on an insertion order for budget segment(s).
   *
   * The budget segment starts on `startDate` and ends on `endDate`.
   */
  getSpendForInsertionOrder(insertionOrderId: string, startDate: number, endDate: number): number {
    return this.report[`${insertionOrderId},${startDate},${endDate}`];
  }

  /**
   * The body of a query request.
   *
   * Only used if the appropriate version for the current insertion order
   * doesn't already exist.
   */
  protected queryBody() {
    return {
      metadata: {
        title: `${this.getQueryTitle()} ${this.params.idType === IDType.PARTNER ? 'P' : 'A'}${this.params.id}`,
        dataRange: getDataRange(this.params.startDate, this.params.endDate),
        format: 'CSV',
        sendNotification: false,
      },
      params: {
        type: 'STANDARD',
        groupBys: [
          'FILTER_ADVERTISER',
          'FILTER_INSERTION_ORDER',
          "FILTER_BUDGET_SEGMENT_START_DATE",
          "FILTER_BUDGET_SEGMENT_END_DATE",
          "FILTER_BUDGET_SEGMENT_DESCRIPTION",
        ],
        metrics: ['METRIC_BILLABLE_COST_USD'],
        filters: [
          {
            type: this.params.idType === IDType.PARTNER ? 'FILTER_PARTNER' : 'FILTER_ADVERTISER',
            value: String(this.params.id),
          },
        ],
      },
    };
  }

  protected getReport(): Record<string, number> {
    const queryId = this.fetchQueryId();
    const reportUrl = this.fetchReportUrl(queryId);
    const report = this.fetchReport(reportUrl);
    const headers = Object.fromEntries(report[0].map((header, idx) =>
        [header, idx]));

    const insertionOrderId = headers['Insertion Order ID'];
    const mediaCost = headers['Billable Cost (USD)'];
    const startDate = headers['Budget Segment Start Date'];
    const endDate = headers['Budget Segment End Date'];
    return report.slice(1, report.length).reduce((prev, curr) => {
      const startTime = new Date(curr[startDate]).getTime();
      const endTime = new Date(curr[endDate]).getTime();
      const key = `${curr[insertionOrderId]},${startTime},${endTime}`;
      prev[key] ??= 0;
      prev[key] += Number(curr[mediaCost]);
      return prev;
    }, {} as {[insertionOrderId: string]: number});
  }
}

/**
 * Returns the first query that matches `REPORT_NAME`, if any.
 */
function getExistingQueryByName(insertionOrderQueryTitle: string): Query | null {
  const queryResponse = JSON.parse(UrlFetchApp.fetch(getQueryUrl('queries'), apiParams()).getContentText()) as {queries: Query[]};
  const queryMatchingName: Query[] = queryResponse.queries
      .filter((query: Query) => query.metadata.title === insertionOrderQueryTitle);
  if (queryMatchingName.length) {
    return queryMatchingName[0];
  }
  return null;
}

/**
 * Provides sensible defaults to build a `UrlFetchApp` params object.
 */
function apiParams(requestParams?: {[key: string]: unknown}) {
  const token = ScriptApp.getOAuthToken();
  const baseParams = {
    'contentType': 'application/json',
    'headers':
        {'Authorization': `Bearer ${token}`, 'Accept': 'application/json'},
  };
  return Object.assign({}, baseParams, requestParams || {});
}

function makeJsonDate(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getDataRange(customStartDate: Date, customEndDate: Date) {
  return {
    range: 'CUSTOM_DATES',
    customStartDate: makeJsonDate(customStartDate),
    customEndDate: makeJsonDate(customEndDate),
  };
}

function getQueryUrl(uri: string) {
  return `https://${DBM_URL}/${DBM_API_VERSION}/${uri}`;
}

/**
 * A budget report DAO.
 */
export interface BudgetReportInterface {
  /**
   * Gets the spend for the specific insertion order budget segment. Lazy
   * loaded.
   * @param insertionOrderId
   * @param startTime The time in seconds since epoch
   * @param endTime The time in seconds since epoch
   */
  getSpendForInsertionOrder(
      insertionOrderId: string, startTime: number, endTime: number): number;
}

/**
 * An impression report DAO.
 */
export interface ImpressionReportInterface {
  getImpressionPercentOutsideOfGeos(campaignId: string, geo: string[]): number;
}