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

import * as AdTypes from './ads_api_types';

import URLFetchRequestOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;

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
      'Authorization': `Bearer ${token}`,
      'login-customer-id': String(this.apiInstructions.loginCustomerId),
    };
  }

  *query<
    Q extends AdTypes.QueryBuilder<Params, Joins>,
    Params extends string = Q['queryParams'][number],
    Joins extends AdTypes.JoinType<Params> | undefined = Q['joins'],
  >(
    customerIds: string,
    query: Q,
    queryWheres: string[] = [],
  ): IterableIterator<AdTypes.ReportResponse<Q>> {
    for (const customerId of splitCids(customerIds)) {
      yield* this.queryOne({query, customerId, queryWheres});
    }
  }

  *queryOne<
    Q extends AdTypes.QueryBuilder<Params, Joins>,
    Params extends string = Q['queryParams'][number],
    Joins extends AdTypes.JoinType<Params> | undefined = Q['joins'],
  >({
    query,
    customerId,
    queryWheres = [],
  }: {
    query: Q;
    customerId: string;
    queryWheres: string[];
  }): IterableIterator<AdTypes.ReportResponse<Q>> {
    const url = `https://${this.apiInstructions.apiEndpoint.url}/${this.apiInstructions.apiEndpoint.version}/customers/${customerId}/${this.apiInstructions.apiEndpoint.call}`;
    const params: AdTypes.AdsSearchRequest = {
      pageSize: MAX_PAGE_SIZE,
      query: qlifyQuery(query, queryWheres),
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
      ) as AdTypes.AdsSearchResponse<AdTypes.ReportResponse<Q>>;
      pageToken = res.nextPageToken;
      for (const row of res.results || []) {
        yield row;
      }
    } while (pageToken);
  }
}

/**
 * Base class for all report types.
 */
export abstract class Report<
  Q extends AdTypes.QueryBuilder<Params, Joins>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
  Joins extends AdTypes.JoinType<Params> | undefined = Q['joins'],
> implements AdTypes.ReportInterface<Q, Output, Params, Joins>
{
  constructor(
    protected readonly api: AdTypes.GoogleAdsApiInterface,
    protected readonly clientIds: string[],
    protected readonly clientArgs: AdTypes.AdsClientArgs,
    protected readonly query: Q,
    protected readonly factory: AdTypes.ReportFactoryInterface,
  ) {}

  private *mapIterators(queryWheres: string[] = []) {
    for (const customerId of this.clientIds) {
      yield* this.api.query<Q, Params, Joins>(
        customerId,
        this.query,
        queryWheres,
      );
    }
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
    const results = this.mapIterators(queryWheres);

    // type boilerplate - separated out for readability
    type DefinedJoin = Exclude<Joins, undefined>;
    type JoinKey = keyof DefinedJoin;
    type JoinOutputKey = Extract<
      DefinedJoin[JoinKey],
      AdTypes.UnknownReportClass
    >['output'][number];
    type JoinDict = Record<
      JoinKey,
      Record<
        string,
        Record<
          Extract<
            DefinedJoin[JoinKey],
            AdTypes.UnknownReportClass
          >['query']['output'][number],
          string
        >
      >
    >;

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
    const joins: undefined | JoinDict =
      prefetchedJoins === undefined
        ? undefined
        : (Object.fromEntries(
            Array.from(
              prefetchedJoins,
              ([joinKey, [joinClass, joinMatchKeys]]) => {
                const joinObject = this.factory.create(joinClass);
                // Ensure we get the right type back with "satisfies".
                // Array.from has specific ideas of the data types it wants to return.
                return [
                  joinKey,
                  joinObject.fetch(
                    // get filtered join objects.
                    joinMatchKeys,
                  ),
                ] satisfies [
                  JoinKey,
                  Record<string, Record<JoinOutputKey, string>>,
                ];
              },
            ),
          ) as Record<JoinKey, Record<string, Record<JoinOutputKey, string>>>);
    // finally - transform results and filtered join results.
    return Object.fromEntries(
      Array.from(resultsHolder, (result) => {
        if (joins === undefined) {
          return this.transform(result);
        }
        return this.transform(
          result,
          joins as Joins extends undefined
            ? never
            : Exclude<typeof joins, undefined>,
        );
      }),
    );
  }

  abstract transform(
    result: AdTypes.ReportResponse<Q>,
    joins: Record<
      keyof Exclude<Joins, undefined>,
      Record<
        string,
        Record<
          Extract<
            Joins[keyof Joins],
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
    joins: Joins extends undefined
      ? never
      : Joins[keyof Joins] extends AdTypes.UnknownReportClass
        ? Record<
            keyof Joins,
            Record<
              string,
              Record<
                Extract<
                  Joins[keyof Joins],
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
   */
  protected prefetchForJoins(
    results: IterableIterator<AdTypes.ReportResponse<Q>>,
    joins: undefined | Joins,
  ) {
    type JoinRows = [
      reportClass: AdTypes.UnknownReportClass,
      match: Array<string | number>,
    ];
    if (joins === undefined) {
      return [undefined, undefined];
    }
    const joinMatchKeys = new Map<keyof Joins, JoinRows>();
    const newResults: Array<AdTypes.ReportResponse<Q>> = [];

    for (const result of results) {
      newResults.push(result);
      // each dot portion of a join key should match to a column in the result.
      for (const [join, report] of Object.entries<AdTypes.UnknownReportClass>(
        joins as Record<keyof Joins, AdTypes.UnknownReportClass>,
      )) {
        if (!joinMatchKeys.has(join as keyof Joins)) {
          joinMatchKeys.set(join as keyof Joins, [report, []]);
        }
        // for a joinKey e.g. my.path.to.some.id, retrieve the value in
        // the corresponding object ({"my": {"path": {"to": {"some": {"id": "1"}}}}})
        // such that the end result is "1".
        (joinMatchKeys.get(join as keyof Joins) as JoinRows)[1].push(
          join
            .split('.')
            .reduce<AdTypes.RecursiveRecord<string, string | number>>(
              // Reduce functions don't have a way to let your end result be
              // typed as anything other than the input type.
              // tslint:disable-next-line:no-any
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
  private readonly leafToRoot = new Map<string, string>();

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
    Q extends AdTypes.QueryBuilder<Params, Joins>,
    Output extends string,
    Params extends string = Q['queryParams'][number],
    Joins extends AdTypes.JoinType<Params> | undefined = Q['joins'],
    ChildReport extends AdTypes.ReportInterface<
      Q,
      Output,
      Params,
      Joins
    > = AdTypes.ReportInterface<Q, Output, Params, Joins>,
  >(
    reportClass: AdTypes.ReportClass<Q, Output, Params, Joins, ChildReport>,
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
      for (const customerId of this.clientArgs.customerIds.split(',')) {
        const api = this.apiFactory.create(
          this.clientArgs.loginCustomerId || this.clientArgs.customerIds,
        );
        const expand = (account: string): string[] => {
          const rows = api.query(customerId, GET_LEAF_ACCOUNTS_REPORT.query);
          const customerIds: string[] = [];
          for (const row of rows) {
            customerIds.push(String(row.customerClient!.id!));
          }
          return customerIds;
        };

        const traverse = (account: string): string[] => {
          // User preference for expansion takes priority.
          // If the user forgot to set expand and there are no children, check
          // anyway. If this account is supposed to be a leaf, the expand query
          // will confirm it.
          return expand(account);
        };

        for (const leaf of traverse(customerId)) {
          // Clobbering is fine: we only need one way to access a given leaf.
          this.leafToRoot.set(leaf, customerId);
        }
      }
    }
    return [...this.leafToRoot.keys()];
  }
}

/**
 * Creates a report class with generics preset.
 *
 * This is useful for making reports without having to write a new
 * report class.
 */
export function makeReport<
  Q extends AdTypes.QueryBuilder<Params, Joins>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
  Joins extends AdTypes.JoinType<Params> | undefined = Q['joins'],
>(args: {
  output: Output[];
  query: Q;
  transform: AdTypes.ReportInterface<Q, Output, Params, Joins>['transform'];
}): AdTypes.ReportClass<Q, Output, Params, Joins> {
  return class ReportImpl extends Report<Q, Output, Params, Joins> {
    transform(
      result: AdTypes.ReportResponse<Q>,
      joins?: Record<
        keyof Joins,
        Record<
          string,
          Record<
            Extract<
              Joins[keyof Joins],
              AdTypes.UnknownReportClass
            >['output'][number],
            string
          >
        >
      >,
    ) {
      if (joins === undefined) {
        // overloading of parameters to allow only `result` is the preferred
        // method. Blocked by https://github.com/microsoft/TypeScript/issues/54539
        // tslint:disable-next-line:ban-as-never
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
  } satisfies AdTypes.ReportClass<Q, Output, Params, Joins>;
}

/**
 * Turn a query into an AdsQL string.
 */
export function qlifyQuery<
  // joins are tricky, and we don't really care what they do here.
  // tslint:disable-next-line:no-any
  Q extends AdTypes.QueryBuilder<Params, any>,
  Params extends string,
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

