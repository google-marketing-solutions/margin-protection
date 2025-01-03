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
export class GoogleAdsApi implements AdTypes.GoogleAdsApiInterface {
  constructor(
    private readonly apiInstructions: {
      developerToken: string;
      loginCustomerId: string;
      credentialManager: CredentialManager;
      apiEndpoint: ApiEndpoint;
    },
  ) {}

  getLoginCustomerId() {
    return this.apiInstructions.loginCustomerId;
  }

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
   * Handles the actual work for the query conversion to AQL, then executes.
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
   * A thin wrapper around {@link qlifyQuery} for testing.
   */
  qlifyQuery<
    Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
    Params extends string = Q['queryParams'][number],
  >(query: Q, queryWheres: string[] = []): string {
    return qlifyQuery(query, queryWheres);
  }
}

/**
 * Base class for all report types.
 */
export abstract class Report<
  Q extends AdTypes.QueryBuilder<AdTypes.Query<Params>>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
> implements AdTypes.ReportInterface<Q, Output>
{
  constructor(
    protected readonly api: AdTypes.GoogleAdsApiInterface,
    protected readonly clientIds: string[],
    protected readonly clientArgs: AdTypes.AdsClientArgs,
    protected readonly query: Q,
    protected readonly factory: AdTypes.ReportFactoryInterface,
  ) {}

  /**
   * Iteratively retrieves query results and returns them as a generator.
   * @param queryWheres An array of filters to place into the WHERE clause
   *   of an AQL query.
   */
  private *mapIterators(queryWheres: string[] = []) {
    yield* this.api.query<Q>(this.clientIds, this.query, queryWheres);
  }

  /**
   * Converts a raw nested API response into its corresponding flat output.
   *
   * {
   *    campaign: {
   *      id: 1
   *    }
   * }
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
   * Fetches the data in a join.
   *
   * This allows the parent query to leverage join data in a transform.
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

  abstract transform(
    result: AdTypes.ReportResponse<Q>,
  ): readonly [
    key: string,
    record: Record<AdTypes.ArrayToUnion<Output[]>, string>,
  ];

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
   * Prefetches any join values.
   *
   * This gets called when a join is requested so that the data can be populated
   * in the Report object. We use this instead of lazy loading because we depend on
   * the data immediately.
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
 * Creates report instances as necessary.async (params:type) => {
 *
 * Injects the API and other dependencies while calling the primary query.
 */
export class ReportFactory implements AdTypes.ReportFactoryInterface {
  /**
   * A list of CID leafs mapped to their parents.
   */
  private readonly leafToRoot = new Set<string>();

  constructor(
    protected readonly apiFactory: GoogleAdsApiFactory,
    protected readonly clientArgs: AdTypes.AdsClientArgs,
  ) {}

  /**
   * Creates a report.
   *
   * Type-safe to a child of {@GoogleAdsFormat} and the Google Ads returned
   * report format ({@link ReportResponse}).
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
   * Returns all leaf account IDs for the initial login account map.
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
 * Creates a report class with generics preset.
 *
 * This is useful for making reports without having to write a new
 * report class.
 *
 * The {@link ReportClass} that's returned is allows you to link to
 * {@link Report#fetch} data from the API.
 *
 * @example
 *   // handled transparently by the Client.
 *   const reportClass = makeReport(args, query, transform)
 *   client.getReport(reportClass).fetch();
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
 * Turn a {@link AdTypes.QueryBuilder<Params, any>} into an AdsQL string.
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
 * Retrieves leaf accounts from a given CID.
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
