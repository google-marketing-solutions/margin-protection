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

/** @fileoverview DAO for the Google Ads API */

import {ClientArgs} from 'googleads/src/types';

import URLFetchRequestOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;


/**
 * The API version, exposed for testing.
 */
export const GOOGLEADS_API_VERSION = 'v14';

/**
 * The API URL, exposed for testing.
 */
export const GOOGLEADS_URL = 'googleads.googleapis.com';

/**
 * Represents a GoogleAdsRow result.
 */
export declare interface GoogleAdsRow {
  customer?: {id?: number};
}

/**
 * A response row from the query API.
 */
export declare interface GoogleAdsSearchResponse {
  nextPageToken: string;
  results: GoogleAdsRow[];
}

/**
 * A request object for the query API.
 */
export declare interface GoogleAdsSearchRequest {
  pageSize: number;
  query: string;
  customerId?: string;
  pageToken?: string;
}

/**
 * Ads API client
 */
export class GoogleAdsApi {
  constructor(private readonly args: ClientArgs) {}

  private requestHeaders() {
    const token = ScriptApp.getOAuthToken();
    return {
      'developer-token': this.args.developerToken,
      'Authorization': `Bearer ${token}`,
      'login-customer-id': this.args.loginCustomerId,
    };
  }

  * query(customerId: string, query: string) {
    const url = `https://${GOOGLEADS_URL}/${GOOGLEADS_API_VERSION}/customers/${
        customerId}/googleAds:search`;
    const params:
        GoogleAdsSearchRequest = {'pageSize': 10_000, query, customerId};
    let pageToken;
    do {
      const req: URLFetchRequestOptions = {
        method: 'post',
        headers: this.requestHeaders(),
        contentType: 'application/json',
        payload: JSON.stringify({...params, pageToken}),
      };
      const res = JSON.parse(UrlFetchApp.fetch(url, req).getContentText()) as
          GoogleAdsSearchResponse;
      pageToken = res.nextPageToken;
      for (const row of res.results) {
        yield row;
      }
    } while (pageToken);
  }
}

global.GoogleAdsApi = GoogleAdsApi;
