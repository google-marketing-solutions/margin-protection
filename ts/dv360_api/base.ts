/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ObjectUtil, UriUtil } from './utils';

/**
 * Represents a paged API response that includes a token for the next page.
 */
export interface PagedDisplayVideoResponse {
  /** The token for retrieving the next page of results. */
  pageToken: string;
}

/**
 * Defines a generic interface for API request parameters.
 */
interface Params {
  [key: string]: string | Params;
}

/**
 * A base class that encapsulates the logic for accessing a Google API using
 * Apps Script's `UrlFetchApp` service. It handles authentication, pagination,
 * and error handling with retries.
 * @see appsscript.json for a list of enabled advanced services and API scopes.
 */
export class BaseApiClient {
  /**
   * Constructs an instance of BaseApiClient.
   *
   * @param apiScope The API scope (e.g., 'displayvideo').
   * @param apiVersion The API version (e.g., 'v2').
   */
  constructor(
    private readonly apiScope: string,
    private readonly apiVersion: string,
  ) {}

  /**
   * Executes a paginated API request and processes all pages of the response.
   *
   * @param requestUris An array of request URIs.
   * @param requestParams The options to use for the request.
   * @param requestCallback A callback function to process the results from
   *     each page.
   * @param maxPages The maximum number of pages to fetch. Defaults to -1,
   *     which indicates that all pages should be fetched.
   */
  executePagedApiRequest(
    requestUris: string[],
    requestParams: { [key: string]: string } | null,
    requestCallback: (p1: { [key: string]: unknown }) => void,
    maxPages: number = -1,
  ) {
    let urls = requestUris.map((r) => this.buildApiUrl(r));
    let pageCount = 1;
    let pageToken: string;
    do {
      const results = this.executeApiRequest(urls, requestParams, true);
      console.log(`Output results page: ${pageCount}`);
      const newUrls = [];
      for (const [i, result] of results.entries()) {
        requestCallback(result);
        pageToken = result.nextPageToken;
        if (pageToken) {
          if (requestParams && requestParams['payload']) {
            const payload = JSON.parse(String(requestParams['payload']));
            payload.pageToken = pageToken;
            requestParams['payload'] = JSON.stringify(payload);
          } else {
            newUrls.push(
              UriUtil.modifyUrlQueryString(urls[i], 'pageToken', pageToken),
            );
          }
        }
        pageCount++;
      }
      urls = newUrls;
    } while (pageToken && (maxPages < 0 || pageCount <= maxPages));
  }

  /**
   * Executes a batch of API requests using `UrlFetchApp.fetchAll` and handles
   * errors with a retry mechanism.
   *
   * @param requestUris An array of request URIs.
   * @param requestParams The options to use for the request.
   * @param retryOnFailure Whether the operation should be retried on failure.
   * @param operationCount The current retry attempt count.
   * @return An array of parsed JSON response objects.
   */
  executeApiRequest(
    requestUris: string[],
    requestParams: Params | null,
    retryOnFailure: boolean,
    operationCount: number = 0,
  ) {
    const urls = requestUris.map((r) => this.buildApiUrl(r));
    const params = this.buildApiParams(requestParams);
    const maxRetries = 3;

    try {
      console.log(
        `Fetching ${urls.length} urls=${urls[0]}... with params=${JSON.stringify(params)}`,
      );
      const responses = UrlFetchApp.fetchAll(
        urls.map((url) => ({ url, ...params })),
      );
      return responses.map((response) =>
        response.getContentText()
          ? (JSON.parse(response.getContentText()) as {
              nextPageToken?: string;
            })
          : {},
      );
    } catch (e) {
      console.error(`Operation failed with exception: ${e}`);

      if (retryOnFailure && operationCount < maxRetries) {
        console.info(`Retrying operation for a max of ${maxRetries} times...`);
        operationCount++;
        return this.executeApiRequest(
          requestUris,
          params,
          retryOnFailure,
          operationCount,
        );
      } else {
        console.warn(
          'Retry on failure not supported or all retries ' +
            'have been exhausted... Failing!',
        );
        throw e;
      }
    }
  }

  /**
   * Constructs the fully-qualified API URL.
   *
   * @param requestUri The partial URI of the request (e.g., 'advertisers').
   * @return The fully-qualified API URL.
   */
  buildApiUrl(requestUri: string): string {
    const protocolAndDomain = `https://${this.apiScope}.googleapis.com/`;

    if (requestUri.startsWith(protocolAndDomain)) {
      return requestUri;
    }
    return `${protocolAndDomain}${this.apiVersion}/${requestUri}`;
  }

  /**
   * Constructs the parameters object for an API request, including the OAuth
   * token and default headers.
   *
   * @param requestParams Custom options to extend the base parameters.
   * @return The complete request parameters object.
   */
  buildApiParams(requestParams: Params | null): Params {
    const token = ScriptApp.getOAuthToken();
    const baseParams: Params = {
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    };
    return ObjectUtil.extend(baseParams, requestParams || {});
  }

  /**
   * Returns the API scope used by this client instance.
   * @return The API scope.
   */
  getApiScope(): string {
    return this.apiScope;
  }

  /**
   * Returns the API version used by this client instance.
   * @return The API version.
   */
  getApiVersion(): string {
    return this.apiVersion;
  }
}
