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
 * @fileoverview This file provides a Data Access Object (DAO) for interacting
 * with the Google Ads and SA360 APIs. It includes classes for managing API
 * credentials, creating API clients, and building and executing reports.
 */

import * as AdTypes from './ads_api_types';

// type boilerplate - separated out for readability
type DefinedJoin<Joins> = Exclude<Joins, undefined>;
type JoinKey<Joins> = keyof DefinedJoin<Joins>;
type JoinOutputKey<Joins> = Extract<
  DefinedJoin<Joins>[JoinKey<Joins>],
  AdTypes.UnknownReportClass
>['output'][number];
type JoinDict<Joins> = Record<
  JoinKey<Joins>,
  Record<
    string,
    Record<
      Extract<
        DefinedJoin<Joins>[JoinKey<Joins>],
        AdTypes.UnknownReportClass
      >['query']['output'][number],
      string
    >
  >
>;

// Ads API has a limit of 10k rows.
const MAX_PAGE_SIZE = 10_000;

interface ApiEndpoint {
  url: string;
  version: string;
  call: string;
}

/**
 * The Google Ads API endpoint.
 */
export const GOOGLEADS_API_ENDPOINT = {
  url: 'googleads.googleapis.com',
  version: 'v11',
  call: 'googleAds:search',
};

/**
 * The SA360 API endpoint.
 */
export const SA360_API_ENDPOINT = {
  url: 'searchads360.googleapis.com',
  version: 'v0',
  call: 'searchAds360:search',
};

/**
 * A factory class that creates and caches instances of `GoogleAdsApi`.
 * This prevents re-instantiating the API client for the same login customer ID.
 */
export class GoogleAdsApiFactory {
  private readonly cache = new Map<string, GoogleAdsApi>();

  /**
   * @param factoryArgs The arguments required to create a `GoogleAdsApi`
   *     instance.
   */
  constructor(
    private readonly factoryArgs: {
      developerToken: string;
      credentialManager: CredentialManager;
      apiEndpoint: ApiEndpoint;
    },
  ) {}

  /**
   * Creates a new `GoogleAdsApi` instance or returns a cached one.
   * @param loginCustomerId The login customer ID to use for the API calls.
   * @return A `GoogleAdsApi` instance.
   */
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
 * Manages OAuth2 access tokens for API requests.
 * It fetches a token using `ScriptApp.getOAuthToken()` and caches it for the
 * duration of the script execution.
 */
export class CredentialManager {
  private token?: string;

  /**
   * Retrieves the cached OAuth2 token or fetches a new one.
   * @return The OAuth2 access token.
   */
  getToken(): string {
    // Access tokens will always outlive an Apps Script invocation
    if (!this.token) {
      this.token = ScriptApp.getOAuthToken();
    }
    return this.token;
  }
}

/**
 * A client for making requests to the Google Ads API.
 * It handles query construction, request headers, and multi-account querying.
 */
export class GoogleAdsApi implements AdTypes.GoogleAdsApiInterface {
  /**
   * @param apiInstructions The configuration required for API requests.
   */
  constructor(
    private readonly apiInstructions: {
      developerToken: string;
      loginCustomerId: string;
      credentialManager: CredentialManager;
      apiEndpoint: ApiEndpoint;
    },
  ) {}

  /**
   * Returns the login customer ID used by this API client instance.
   * @return The login customer ID.
   */
  getLoginCustomerId() {
    return this.apiInstructions.loginCustomerId;
  }

  /**
   * Constructs the required HTTP headers for an Ads API request.
   * @return The request headers.
   * @private
   */
  private requestHeaders() {
    const token = this.apiInstructions.credentialManager.getToken();
    return {
      ...(this.apiInstructions.developerToken
        ? {
            'developer-token': this.apiInstructions.developerToken,
          }
        : {}),
      Authorization: `Bearer ${token}`,
      'login-customer-id': String(this.apiInstructions.loginCustomerId),
    };
  }

  /**
   * Executes a query against one or more customer accounts.
   * @param customerIds An array of customer IDs to query.
   * @param query The query builder object.
   * @param queryWheres Additional WHERE clauses to append to the query.
   * @yields The report response rows from the API.
   */
  *query<
    Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
    Params extends string = Q['queryParams'][number],
  >(
    customerIds: string[],
    query: Q,
    queryWheres: string[] = [],
  ): IterableIterator<AdTypes.ReportResponse<Q>> {
    const cleanCustomerIds = customerIds.flatMap(splitCids);
    //const result = [...this.queryOne({ query, customerIds: cleanCustomerIds, queryWheres })];
    //yield* result;
    yield* this.queryOne({ query, customerIds: cleanCustomerIds, queryWheres });
  }

  /**
   * Handles the core logic of converting a query to Ads Query Language (AQL),
   * executing it via `UrlFetchApp.fetchAll`, and handling pagination.
   * @param params The parameters for the query execution.
   * @yields The report response rows from the API.
   * @private
   */
  *queryOne<
    Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
    Params extends string = Q['queryParams'][number],
  >({
    query,
    customerIds,
    queryWheres = [],
  }: {
    query: Q;
    customerIds: string[];
    queryWheres: string[];
  }): IterableIterator<AdTypes.ReportResponse<Q>> {
    const paramAndUrlArray = customerIds.map((customerId) => {
      const url = `https://${this.apiInstructions.apiEndpoint.url}/${this.apiInstructions.apiEndpoint.version}/customers/${customerId}/${this.apiInstructions.apiEndpoint.call}`;

      return {
        url,
        params: {
          pageSize: MAX_PAGE_SIZE,
          query: this.qlifyQuery(query, queryWheres),
          customerId,
        } satisfies AdTypes.AdsSearchRequest,
      };
    });

    const requests: GoogleAppsScript.URL_Fetch.URLFetchRequest[] =
      customerIds.map((_, i) => {
        return {
          url: paramAndUrlArray[i].url,
          method: 'post',
          headers: this.requestHeaders(),
          contentType: 'application/json',
          payload: JSON.stringify(paramAndUrlArray[i].params),
        };
      });

    let pendingRequests = [...requests];
    do {
      const responses = UrlFetchApp.fetchAll(pendingRequests).map(
        (response) =>
          JSON.parse(response.getContentText()) as AdTypes.AdsSearchResponse<
            AdTypes.ReportResponse<Q>
          >,
      );
      pendingRequests = [];
      for (const [i, response] of responses.entries()) {
        if (response.nextPageToken) {
          const newRequest = { ...requests[i] };
          newRequest.payload = JSON.stringify({
            ...paramAndUrlArray[i],
            pageToken: response.nextPageToken,
          });
          pendingRequests.push(newRequest);
        }
        if (response.results) {
          yield* response.results;
        }
      }
    } while (pendingRequests.length);
  }

  /**
   * A thin wrapper around {@link qlifyQuery} for testing purposes.
   * @param query The query builder object.
   * @param queryWheres Additional WHERE clauses.
   * @return The formatted AQL query string.
   */
  qlifyQuery<
    Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
    Params extends string = Q['queryParams'][number],
  >(query: Q, queryWheres: string[] = []): string {
    return qlifyQuery(query, queryWheres);
  }
}

/**
 * An abstract base class for defining specific report types.
 * It provides the core logic for fetching data, handling joins, and
 * transforming the results.
 * @template Q The query builder type.
 * @template Output The output field names.
 * @template Params The query parameter names.
 */
export abstract class Report<
  Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
> implements AdTypes.ReportInterface<Q, Output>
{
  /**
   * @param api An instance of the Google Ads API client.
   * @param clientIds An array of customer IDs to query.
   * @param clientArgs The client arguments.
   * @param query The query builder object for this report.
   * @param factory An instance of the ReportFactory.
   */
  constructor(
    protected readonly api: AdTypes.GoogleAdsApiInterface,
    protected readonly clientIds: string[],
    protected readonly clientArgs: AdTypes.AdsClientArgs,
    protected readonly query: Q,
    protected readonly factory: AdTypes.ReportFactoryInterface,
  ) {}

  /**
   * A generator that iteratively retrieves query results.
   * @param queryWheres An array of filters to append to the WHERE clause.
   * @yields The report response rows.
   * @private
   */
  private *mapIterators(queryWheres: string[] = []) {
    yield* this.api.query<Q>(this.clientIds, this.query, queryWheres);
  }

  /**
   * Fetches the report data, processes any joins, and transforms the results
   * into a flat key-value record.
   * @param queryWheres An array of filters to append to the WHERE clause.
   * @return A record where keys are the primary entity's ID and values are
   *     records of the fetched data.
   */
  fetch(queryWheres: string[] = []): Record<string, Record<Output, string>> {
    const results = this.api.query<Q>(this.clientIds, this.query, queryWheres);

    let resultsHolder:
      | IterableIterator<AdTypes.ReportResponse<Q>>
      | Array<AdTypes.ReportResponse<Q>> = results;
    // first - get all results and find joins
    // this is a full extra loop of data, but it should be much cheaper than
    // querying everything in AQL.
    const [newResults, prefetchedJoins] = this.prefetchForJoins(
      results,
      this.query.joins,
    );
    if (newResults !== undefined) {
      resultsHolder = newResults;
    }
    // now - create the {@link joins} object.
    //
    // This is a single line because otherwise TypeScript gets upset
    // that we haven't declared individual pieces of the code. This winds up
    // being more typesafe than using {@code Partial}s.
    const joins: undefined | JoinDict<Q['joins']> =
      prefetchedJoins === undefined
        ? undefined
        : (Object.fromEntries(
            Array.from(
              prefetchedJoins,
              this.joinMergeFunction.bind(
                this,
              ) as typeof this.joinMergeFunction,
            ),
          ) as Record<
            JoinKey<Q['joins']>,
            Record<string, Record<JoinOutputKey<Q['joins']>, string>>
          >);
    // finally - transform results and filtered join results.
    return Object.fromEntries(this.unpackResults(resultsHolder, joins));
  }

  /**
   * Unpacks the results from the iterator and applies the transform function.
   * @param resultsHolder The iterator or array of report responses.
   * @param joins The dictionary of joined data.
   * @return An array of transformed key-value pairs.
   * @private
   */
  private unpackResults(
    resultsHolder:
      | IterableIterator<AdTypes.ReportResponse<Q>>
      | Array<AdTypes.ReportResponse<Q>>,
    joins: undefined | JoinDict<Q['joins']>,
  ): Array<readonly [key: string, record: Record<Output, string>]> {
    const completedResults: Array<
      readonly [key: string, record: Record<Output, string>]
    > = [];
    for (const result of resultsHolder) {
      if (joins === undefined) {
        completedResults.push(this.transform(result));
        continue;
      }
      try {
        completedResults.push(
          this.transform(
            result,
            joins as Q['joins'] extends undefined
              ? never
              : Exclude<typeof joins, undefined>,
          ),
        );
      } catch {
        console.debug(`skipping result ${result}: not transformable`);
        continue;
      }
      // clean any empty values
    }
    return completedResults.filter(([_, e]) => e);
  }

  /**
   * Fetches the data for a single join defined in the query.
   * This allows the parent query to leverage the joined data in its transform
   * function.
   * @param joinKey The key identifying the join.
   * @param joinClass The report class for the entity being joined.
   * @param joinMatchKeys The foreign key values from the parent query to use
   *     for the join.
   * @return A tuple containing the join key and the fetched join data.
   * @private
   */
  private joinMergeFunction([joinKey, [joinClass, joinMatchKeys]]): [
    JoinKey<Q['joins']>,
    Record<string, Record<JoinOutputKey<Q['joins']>, string>>,
  ] {
    const joinObject = this.factory.create(joinClass);
    const dedupedJoinMatchKeys = [...new Set(joinMatchKeys)].join(',');
    const dedupedJoinMatchQuery = `${joinClass.query.queryFrom}.id IN (${dedupedJoinMatchKeys})`;
    // Ensure we get the right type back with "satisfies".
    // Array.from has specific ideas of the data types it wants to return.
    return [joinKey, joinObject.fetch([dedupedJoinMatchQuery])] satisfies [
      JoinKey<Q['joins']>,
      Record<string, Record<JoinOutputKey<Q['joins']>, string>>,
    ];
  }

  /**
   * Abstract method to transform a single row of the report response into a
   * key-value pair.
   * @param result A single row from the API response.
   * @param joins A dictionary of joined data, if applicable.
   */
  abstract transform(
    result: AdTypes.ReportResponse<Q>,
    joins: Record<
      keyof Exclude<Q['joins'], undefined>,
      Record<
        string,
        Record<
          Extract<
            Q['joins'][keyof Q['joins']],
            AdTypes.UnknownReportClass
          >['query']['output'][number],
          string
        >
      >
    >,
  ): readonly [
    key: string,
    record: Record<AdTypes.ArrayToUnion<Output[]>, string>,
  ];

  /**
   * Abstract method to transform a single row of the report response into a
   * key-value pair.
   * @param result A single row from the API response.
   * @param joins A dictionary of joined data, if applicable.
   */
  abstract transform(
    result: AdTypes.ReportResponse<Q>,
  ): readonly [
    key: string,
    record: Record<AdTypes.ArrayToUnion<Output[]>, string>,
  ];

  /**
   * Abstract method to transform a single row of the report response into a
   * key-value pair.
   * @param result A single row from the API response.
   * @param joins A dictionary of joined data, if applicable.
   */
  abstract transform(
    result: AdTypes.ReportResponse<Q>,
    joins: Q['joins'] extends undefined
      ? never
      : Q['joins'][keyof Q['joins']] extends AdTypes.UnknownReportClass
        ? Record<
            keyof Q['joins'],
            Record<
              string,
              Record<
                Extract<
                  Q['joins'][keyof Q['joins']],
                  AdTypes.UnknownReportClass
                >['output'][number],
                string
              >
            >
          >
        : undefined,
  ): readonly [
    key: string,
    record: Record<AdTypes.ArrayToUnion<Output[]>, string>,
  ];

  /**
   * Prefetches data for all joins defined in the query.
   * This method iterates through the initial results to collect all foreign
   * keys needed for the joins, then fetches the join data in a batch.
   * @param results The initial report response iterator.
   * @param joins The join definitions from the query.
   * @return A tuple containing the buffered initial results and a map of the
   *     prefetched join data.
   * @protected
   */
  protected prefetchForJoins(
    results: IterableIterator<AdTypes.ReportResponse<Q>>,
    joins: undefined | Q['joins'],
  ) {
    type JoinRows = [
      reportClass: AdTypes.UnknownReportClass,
      match: Array<string | number>,
    ];
    type JoinClassDict = Record<keyof Q['joins'], AdTypes.UnknownReportClass>;
    if (joins === undefined) {
      return [undefined, undefined];
    }
    const joinMatchKeys = new Map<keyof Q['joins'], JoinRows>();
    const newResults: Array<AdTypes.ReportResponse<Q>> = [];

    for (const result of results) {
      newResults.push(result);
      // each dot portion of a join key should match to a column in the result.
      for (const [join, report] of Object.entries<AdTypes.UnknownReportClass>(
        joins as JoinClassDict,
      )) {
        if (!joinMatchKeys.has(join as keyof Q['joins'])) {
          joinMatchKeys.set(join as keyof Q['joins'], [report, []]);
        }
        // for a joinKey e.g. my.path.to.some.id, retrieve the value in
        // the corresponding object ({"my": {"path": {"to": {"some": {"id": "1"}}}}})
        // such that the end result is "1".
        (joinMatchKeys.get(join as keyof Q['joins']) as JoinRows)[1].push(
          join
            .split('.')
            .reduce<AdTypes.RecursiveRecord<string, string | number>>(
              // Reduce functions don't have a way to let your end result be
              // typed as anything other than the input type.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (res, j) => res[j] as any,
              result as AdTypes.RecursiveRecord<string, string | number>,
            ) as unknown as string | number,
        );
      }
    }
    return [
      newResults,
      joinMatchKeys.size === 0 ? undefined : joinMatchKeys,
    ] as const;
  }
}

/**
 * A factory for creating report instances.
 * It injects the necessary dependencies like the API client and handles the
 * logic for expanding manager accounts into a list of leaf accounts.
 */
export class ReportFactory implements AdTypes.ReportFactoryInterface {
  /**
   * A cache of leaf account IDs mapped to their root manager account.
   * @private
   */
  private readonly leafToRoot = new Set<string>();

  /**
   * @param apiFactory An instance of GoogleAdsApiFactory.
   * @param clientArgs The client arguments containing customer IDs.
   */
  constructor(
    protected readonly apiFactory: GoogleAdsApiFactory,
    protected readonly clientArgs: AdTypes.AdsClientArgs,
  ) {}

  /**
   * Creates an instance of a specified report class.
   * @param reportClass The report class to instantiate.
   * @return An instance of the requested report class.
   */
  create<
    Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
    Output extends string,
    Params extends string = Q['queryParams'][number],
    ChildReport extends AdTypes.ReportInterface<
      Q,
      Output
    > = AdTypes.ReportInterface<Q, Output>,
  >(
    reportClass: AdTypes.ReportClass<Q, Output, Params, ChildReport>,
  ): ChildReport {
    const allClientIds = splitCids(this.clientArgs.customerIds);
    if (!this.clientArgs.loginCustomerId && allClientIds.length > 1) {
      throw new Error(
        'Please provide a single login customer ID for multiple CIDs.',
      );
    }
    const leafAccounts = this.leafAccounts();
    const api = this.apiFactory.create(
      this.clientArgs.loginCustomerId || this.clientArgs.customerIds,
    );
    return new reportClass(
      api,
      leafAccounts,
      this.clientArgs,
      reportClass.query,
      this,
    );
  }

  /**
   * Returns a list of all leaf account IDs under the initial manager account(s).
   * It traverses the account hierarchy to find all serving, non-manager
   * accounts.
   * @return An array of leaf account customer IDs.
   */
  leafAccounts(): string[] {
    if (!this.leafToRoot.size) {
      const customerIds = this.clientArgs.customerIds.split(',');
      if (!this.clientArgs.loginCustomerId && customerIds.length > 1) {
        throw new Error(
          'A login customer ID must be provided when multiple CIDs are selected.',
        );
      }
      const api = this.apiFactory.create(
        this.clientArgs.loginCustomerId || this.clientArgs.customerIds,
      );
      const expand = (accounts: string[]): string[] => {
        const rows = api.query(accounts, GET_LEAF_ACCOUNTS_REPORT.query);
        const customerIds: string[] = [];
        for (const row of rows) {
          customerIds.push(String(row.customerClient!.id!));
        }
        return customerIds;
      };

      const traverse = (accounts: string[]): string[] => {
        // User preference for expansion takes priority.
        // If the user forgot to set expand and there are no children, check
        // anyway. If this account is supposed to be a leaf, the expand query
        // will confirm it.
        return expand(accounts);
      };

      for (const leaf of traverse(customerIds)) {
        this.leafToRoot.add(leaf);
      }
    }
    return [...this.leafToRoot];
  }
}

/**
 * A factory function that creates a new `Report` class definition dynamically.
 * This is useful for creating simple, one-off reports without the boilerplate
 * of defining a new class.
 *
 * @example
 *   const MyReport = makeReport({
 *     output: ['campaign.id', 'campaign.name'],
 *     query: buildQuery({...}),
 *     transform: (row) => [row.campaign.id, { 'id': row.campaign.id, ... }],
 *   });
 *   const reportInstance = client.getReport(MyReport);
 *   reportInstance.fetch();
 *
 * @param args The report definition arguments.
 * @return A new class that extends `Report`.
 */
export function makeReport<
  Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
>(args: {
  output: Output[];
  query: Q;
  transform: AdTypes.ReportInterface<Q, Output>['transform'];
}): AdTypes.ReportClass<Q, Output> {
  return class ReportImpl extends Report<Q, Output> {
    transform(
      result: AdTypes.ReportResponse<Q>,
      joins?: Record<
        keyof Q['joins'],
        Record<
          string,
          Record<
            Extract<
              Q['joins'][keyof Q['joins']],
              AdTypes.UnknownReportClass
            >['output'][number],
            string
          >
        >
      >,
    ) {
      if (joins === undefined) {
        return args.transform(result, undefined as never);
      } else {
        return args.transform(
          result,
          joins as Extract<typeof joins, undefined>,
        );
      }
    }
    static query = args.query;
    static output = args.output;
  } satisfies AdTypes.ReportClass<Q, Output>;
}

/**
 * Converts a query builder object into a valid Ads Query Language (AQL) string.
 *
 * @param query The query builder object.
 * @param queryWheres An array of additional `WHERE` clauses to append.
 * @return The complete AQL query string.
 */
export function qlifyQuery<
  Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
  Params extends string = Q['queryParams'][number],
>(query: Q, queryWheres: string[] = []): string {
  const aql = `SELECT ${query.queryParams.join(', ')} FROM ${query.queryFrom}`;
  const allWheres = [...(query.queryWheres ?? []), ...queryWheres];
  const wheres = allWheres.length ? ` WHERE ${allWheres.join(' AND ')}` : '';
  return `${aql}${wheres}`;
}

/**
 * Splits a comma-separated string of customer IDs into an array and validates
 * that each ID contains only digits.
 * @param customerIdsStr The comma-separated string of customer IDs.
 * @return An array of validated customer ID strings.
 * @throws If any customer ID is invalid.
 * @private
 */
function splitCids(customerIdsStr: string) {
  const customerIds = customerIdsStr.replace(/- /, '').split(',');
  if (customerIds.some((cid) => !cid.match(/^\d+$/))) {
    throw new Error(
      `Invalid customer ids. Expected only numbers, got ${customerIds.filter(
        (cid) => !cid.match(/^d+$/),
      )}`,
    );
  }
  return customerIds;
}

/**
 * A predefined report for retrieving all leaf accounts under a manager account.
 */
export const GET_LEAF_ACCOUNTS_REPORT = makeReport({
  output: ['customerId', 'customerName', 'customerStatus'],
  query: AdTypes.buildQuery({
    queryParams: [
      'customer_client.id',
      'customer_client.descriptive_name',
      'customer.status',
    ],
    queryFrom: 'customer_client',
    queryWheres: [
      'customer_client.manager = false',
      "customer_client.status = 'ENABLED'",
    ],
  }),
  transform(result) {
    return [
      result.customerClient.id as string,
      {
        customerId: result.customerClient.id as string,
        customerName: result.customerClient.descriptiveName as string,
        customerStatus: result.customer.status as string,
      },
    ];
  },
});
