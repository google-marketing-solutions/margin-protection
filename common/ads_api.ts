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
 * @fileoverview DAO for the Google Ads API and SA360 API
 */

// g3-format-prettier

import {
  AccountMap,
  AdsRow,
  AdsSearchRequest,
  AdsSearchResponse,
  CampaignReport,
} from './ads_api_types';

import URLFetchRequestOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;

// Ads API has a limit of 10k rows.
const MAX_PAGE_SIZE = 10_000;

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

const GAQL_GET_CAMPAIGN_REPORT = `SELECT
  customer.id,
  customer.descriptive_name,
  campaign.id,
  campaign.name,
  campaign.status
FROM campaign`;

interface ApiEndpoint {
  url: string;
  version: string;
}

/**
 * The Google Ads API endpoint.
 */
export const GOOGLEADS_API_ENDPOINT = {
  url: 'googleads.googleapis.com',
  version: 'v11',
};

/**
 * The SA360 API endpoint.
 */
export const SA360_API_ENDPOINT = {
  url: 'searchads360.googleapis.com',
  version: 'v0',
};

/**
 * Caching factory for Ads API instantiation.
 */
export class GoogleAdsApiFactory {
  private readonly cache = new Map<string, GoogleAdsApi>();

  constructor(
    private readonly factoryArgs: {
      developerToken: string;
      credentialManager: CredentialManager;
      apiEndpoint: ApiEndpoint;
    },
  ) {}

  create(loginCustomerId: string) {
    let api = this.cache.get(loginCustomerId);
    if (!api) {
      api = new GoogleAdsApi({
        developerToken: this.factoryArgs.developerToken,
        loginCustomerId,
        credentialManager: this.factoryArgs.credentialManager,
        apiEndpoint: this.factoryArgs.apiEndpoint,
      });
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
    private readonly apiInstructions: {
      developerToken: string;
      loginCustomerId: string;
      credentialManager: CredentialManager;
      apiEndpoint: ApiEndpoint;
    },
  ) {}

  private requestHeaders() {
    const token = this.apiInstructions.credentialManager.getToken();
    return {
      'developer-token': this.apiInstructions.developerToken,
      'Authorization': `Bearer ${token}`,
      'login-customer-id': this.apiInstructions.loginCustomerId,
    };
  }

  *query(customerId: string, query: string): IterableIterator<AdsRow> {
    const url = `https://${this.apiInstructions.apiEndpoint.url}/${this.apiInstructions.apiEndpoint.version}/customers/${customerId}/googleAds:search`;
    const params: AdsSearchRequest = {
      pageSize: MAX_PAGE_SIZE,
      query,
      customerId,
    };
    let pageToken;
    do {
      const req: URLFetchRequestOptions = {
        method: 'post',
        headers: this.requestHeaders(),
        contentType: 'application/json',
        payload: JSON.stringify({...params, pageToken}),
      };
      const res = JSON.parse(
        UrlFetchApp.fetch(url, req).getContentText(),
      ) as AdsSearchResponse;
      pageToken = res.nextPageToken;
      for (const row of res.results || []) {
        yield row;
      }
    } while (pageToken);
  }
}

/**
 * Traverses MCC hierarchies to generate cached reports over all leaf accounts.
 */
export class ReportGenerator {
  private readonly leafToRoot = new Map<string, string>();

  /**
   * @param loginAccounts The top-level accounts to query, and expansion
   *     instructions.
   * @param apiFactory An injectable api client factory.
   */
  constructor(
    private readonly loginAccounts: AccountMap[],
    private readonly apiFactory: GoogleAdsApiFactory,
  ) {}

  campaignReports(): CampaignReport[] {
    const report: CampaignReport[] = [];

    const leafAccounts = this.leafAccounts();
    for (const customerId of leafAccounts) {
      const api = this.apiFactory.create(this.leafToRoot.get(customerId)!);
      const rows = api.query(customerId, GAQL_GET_CAMPAIGN_REPORT);
      for (const row of rows) {
        report.push({
          customerId,
          customerName: row.customer?.descriptiveName ?? '',
          id: String(row.campaign?.id ?? ''),
          name: row.campaign?.descriptiveName ?? '',
          status: row.campaign?.status ?? 'UNKNOWN',
        });
      }
    }

    return report;
  }

  /**
   * Returns all leaf account IDs for the initial login account map.
   */
  leafAccounts(): string[] {
    if (!this.leafToRoot.size) {
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
          // Clobbering is fine: we only need one way to access a given leaf.
          this.leafToRoot.set(leaf, loginAccount.customerId);
        }
      }
    }
    return [...this.leafToRoot.keys()];
  }
}

