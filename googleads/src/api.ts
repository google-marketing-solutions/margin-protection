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

import {AccountMap} from './types';

import URLFetchRequestOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;


/**
 * The API version, exposed for testing.
 */
export const GOOGLEADS_API_VERSION = 'v14';

/**
 * The API URL, exposed for testing.
 */
export const GOOGLEADS_URL = 'googleads.googleapis.com';

// Returns all leafs, even if the root account is a leaf.
const GAQL_GET_LEAF_ACCOUNTS = `SELECT
  customer_client.id,
  customer_client.descriptive_name,
  customer_client.manager,
  customer.status
FROM customer_client
WHERE
  customer_client.manager = false
  AND customer_client.status = 'ENABLED'`;

/**
 * Represents a GoogleAdsRow result.
 */
export declare interface GoogleAdsRow {
  customer?: {id?: number};
  customerClient?: {
    id?: number,
    descriptiveName?: string,
    manager?: boolean,
    status?: string
  };
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
 * Caching factory for Ads API instantiation.
 */
export class GoogleAdsApiFactory {
  private readonly cache = new Map<string, GoogleAdsApi>();

  constructor(
      private readonly developerToken: string,
      private readonly credentialManager: CredentialManager) {}

  create(loginCustomerId: string) {
    let api = this.cache.get(loginCustomerId);
    if (!api) {
      api = new GoogleAdsApi(
        this.developerToken, loginCustomerId, this.credentialManager);
      this.cache.set(loginCustomerId, api);
    }
    return api;
  }
}

/**
 * Manages access token generation.
 */
export class CredentialManager {
  private token?: string;

  getToken(): string {
    // Access tokens will always outlive an Apps Script invocation
    if (!this.token) {
      this.token = ScriptApp.getOAuthToken();
    }
    return this.token;
  }
}

/**
 * Ads API client
 */
export class GoogleAdsApi {
  constructor(
      private readonly developerToken: string,
      private readonly loginCustomerId: string,
      private readonly credentialManager: CredentialManager) {}

  private requestHeaders() {
    const token = this.credentialManager.getToken();
    return {
      'developer-token': this.developerToken,
      'Authorization': `Bearer ${token}`,
      'login-customer-id': this.loginCustomerId,
    };
  }

  * query(customerId: string, query: string): IterableIterator<GoogleAdsRow> {
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

/**
 * Traverses MCC hierarchies to generate cached reports over all leaf accounts.
 */
export class ReportGenerator {
  private readonly customerIds = new Set<string>();

  /**
   * @param loginAccounts The top-level accounts to query, and expansion
   *     instructions.
   * @param apiFactory An injectable api client factory.
   */
  constructor(
      private readonly loginAccounts: AccountMap[],
      private readonly apiFactory: GoogleAdsApiFactory) {}

  /**
   * Returns all leaf account IDs for the initial login account map.
   */
  leafAccounts(): string[] {
    if (!this.customerIds.size) {
      for (const loginAccount of this.loginAccounts) {
        const api = this.apiFactory.create(loginAccount.customerId);

        const expand = (account: AccountMap): string[] => {
          const rows = api.query(account.customerId, GAQL_GET_LEAF_ACCOUNTS);
          const customerIds: string[] = [];
          for (const row of rows) {
            customerIds.push(String(row.customerClient!.id!));
          }
          return customerIds;
        };

        const traverse = (account: AccountMap): string[] => {
          // User preference for expansion takes priority.
          // If the user forgot to set expand and there are no children, check
          // anyway. If this account is supposed to be a leaf, the expand query
          // will confirm it.
          if (account.expand || !(account.children ?? []).length) {
            return expand(account);
          }

          // The presence of explicitly-opted-in children indicate user intent
          // to query a partial tree.
          const leaves: string[] = [];
          for (const child of account.children ?? []) {
            leaves.push(...traverse(child));
          }
          return leaves;
        };

        for (const leaf of traverse(loginAccount)) {
          this.customerIds.add(leaf);
        }
      }
    }
    return [...this.customerIds];
  }
}


global.GoogleAdsApi = GoogleAdsApi;
