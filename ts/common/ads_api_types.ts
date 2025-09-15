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
 * @fileoverview This file contains the core TypeScript interfaces and type
 * definitions that provide the data structures and contracts for the Ads API
 * DAO. It defines the shapes for queries, responses, reports, and client
 Z* arguments.
 */

import { BaseClientArgs } from './types';

/**
 * Defines the basic structure of a query, including the fields to select, the
 * resource to query from, and optional joins.
 */
export interface NonGenericQueryBuilder {
  /** The list of fields to select in the query. */
  queryParams: readonly string[];
  /** The resource to query from (e.g., 'campaign'). */
  queryFrom: string;
  /** An optional record of other reports to join on. */
  joins?: Record<string, unknown>;
}

/**
 * Represents a single page of results from an Ads API search request.
 * @template T The type of a single result row.
 */
export declare interface AdsSearchResponse<T> {
  /** A token that can be used to retrieve the next page of results. */
  nextPageToken?: string;
  /** An array of result rows. */
  results?: T[];
}

/**
 * Defines the structure of a search request sent to the Ads API.
 */
export declare interface AdsSearchRequest {
  /** The number of rows to retrieve per page. */
  pageSize: number;
  /** The Ads Query Language (AQL) query string. */
  query: string;
  /** The customer ID to run the query against. */
  customerId?: string;
  /** The token for retrieving the next page of results. */
  pageToken?: string;
}

/**
 * A utility type that creates a union of all string elements in a tuple.
 * @template S A tuple of strings.
 */
export type ArrayToUnion<S extends string[]> = S[number];

/**
 * Represents the hierarchical structure of Ads accounts for reporting.
 */
export interface AccountMap {
  /**
   * The customer ID of the Google Ads account. The root node should always
   * contain a login customer ID.
   */
  readonly customerId: string;
  /** If true, reporting will be expanded to include all child accounts. */
  expand?: boolean;
  /**
   * Restricts reporting to a specific subset of child accounts. If empty, the
   * behavior depends on the `expand` flag.
   */
  children?: AccountMap[];
}

/**
 * Defines the Ads-specific arguments required by the client.
 */
export interface AdsClientArgs extends BaseClientArgs<AdsClientArgs> {
  /** The MCC login customer ID, required when querying multiple CIDs. */
  loginCustomerId?: string;
  /** A comma-separated string of customer IDs to run reports on. */
  customerIds: string;
}

/**
 * A utility type that converts a snake_case string to camelCase.
 * @template S The snake_case string.
 * @example
 *   const transformed: CamelCase<'my_field_name'> = 'myFieldName';
 */
export type CamelCase<S extends string> =
  S extends `_${infer NextLetter}${infer Rest}`
    ? `${Uppercase<NextLetter>}${CamelCase<Rest>}`
    : S extends ''
      ? ''
      : S extends `${infer NextLetter extends string}${infer Rest}`
        ? `${NextLetter}${CamelCase<Rest>}`
        : '';

/**
 * A utility type that enforces a specific type literal.
 * @template S The literal type.
 * @template T The base type.
 */
export type TypeLiteral<S, T> = S extends T ? (T extends S ? never : S) : never;

/**
 * A utility type for a string literal, ensuring it's a constant string.
 * @template S The string literal.
 */
export type StringLiteral<S extends string> = TypeLiteral<S, string>;

/**
 * A utility type that converts a dot-separated string path into a nested object
 * structure.
 * @template S The dot-separated string.
 * @example
 *   type MyObject = DotsToObject<'campaign.ad_group.id'>;
 *   // Results in: { campaign: { adGroup: { id: unknown } } }
 */
export type DotsToObject<S extends string> = S extends ''
  ? never
  : S extends `${infer First}.${infer Rest}`
    ? '' extends First
      ? object
      : { [key in CamelCase<First>]: DotsToObject<Rest> }
    : '' extends S
      ? object
      : { [key in CamelCase<S>]: unknown };

/**
 * A utility type that transforms the dot-notation fields from a query's
 * `queryParams` into a nested object representing a single API response row.
 * @template Q The query builder object.
 * @template Params The parameter names from the query.
 */
export type ReportResponse<
  Q extends QueryBuilder<Query<Params>>,
  Params extends string = Q['queryParams'][number],
> = UnionToIntersection<DotsToObject<Q['queryParams'][number]>> & {};

/**
 * A helper type that converts a union of types into an intersection of types.
 * @template U The union type (e.g., A | B).
 * @example
 *  type MyIntersection = UnionToIntersection<{ a: string } | { b: number }>;
 *  // Results in: { a: string } & { b: number }
 */
export type UnionToIntersection<U> = (
  U extends object ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : object;

/**
 * Defines the interface for a Google Ads API client.
 */
export declare interface GoogleAdsApiInterface {
  /**
   * Runs a query against the Google Ads API.
   *
   * @param customerIds A comma-separated list of customer IDs to query.
   * @param query The query to run (a {@link QueryBuilder} type).
   * @param queryWheres Optional list of WHERE clauses to filter the results.
   * @returns An iterator that yields the report rows.
   */
  query<
    Q extends QueryBuilder<Query<Params>>,
    Params extends string = Q['queryParams'][number],
  >(
    customerIds: string[],
    query: Q,
    queryWheres?: string[],
  ): IterableIterator<ReportResponse<Q>>;
}

/**
 * Defines the structure of a report type, including its output fields and the
 * format of a single record.
 * @template Output A tuple of the output field names.
 * @template RecordFormat The type of a single transformed record.
 */
export declare interface AdsReportType<
  Output extends string[],
  RecordFormat extends Record<
    keyof RecordFormat,
    RecordFormat[keyof RecordFormat]
  >,
> {
  /** The names of the fields in the final output record. */
  output: Output;
  /** The structure of a single transformed record. */
  format: RecordFormat;
}

/**
 * A helper function to create a query builder object with type inference.
 * @param args The query builder arguments.
 * @return The constructed query builder object.
 */
export function buildQuery<
  Q extends QueryBuilder<Query<Params>>,
  Params extends string,
>(args: Q): Q {
  return args;
}

/**
 * Represents a deeply nested record, where values can be either the final type
 * or another nested record.
 * @template K The key type (typically string).
 * @template V The value type.
 */
export interface RecursiveRecord<K, V> {
  [key: string]: RecursiveRecord<K, V> | V;
}

/**
 * A type alias for a generic `ReportClass` used in containers or joins where
 * the specific report type is unknown.
 */
// We don't know what will be in a report class.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnknownReportClass = ReportClass<any, any, any>;

/**
 * Defines the structure for joins in a query.
 * It's a partial mapping from a camel-cased parameter name to the
 * `ReportClass` that should be used to fetch the joined data.
 * @template Params The parameter names from the parent query.
 */
export type JoinType<Params extends string> = Partial<{
  [key in Exclude<CamelCase<Params>, ''>]: UnknownReportClass;
}>;

/**
 * Defines the structure of a query for the Ads API.
 * It includes the fields to select, the resource to query from, optional
 * filters, and optional join definitions.
 * @template Q The specific query type.
 * @template Params The parameter names within the query.
 */
export interface QueryBuilder<
  Q extends Query<Params>,
  Params extends string = Q['params'],
> {
  /** The list of fields to select in the query. */
  queryParams: readonly Q['params'][];
  /** The resource to query from (e.g., 'campaign'). */
  queryFrom: string;
  /** An optional array of `WHERE` clause conditions. */
  queryWheres?: string[];
  /** An optional record defining joins to other reports. */
  joins?: Q['joins'];
}

/**
 * Defines the interface for a report object, which is responsible for fetching
 * and transforming data for a specific entity.
 * @template Q The query builder type for this report.
 * @template Output The names of the output fields.
 * @template Params The parameter names from the query.
 */
export interface ReportInterface<
  Q extends QueryBuilder<Query<Params>>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
> {
  /**
   * Fetches and transforms the full report data.
   * @param queryWheres Optional filters to apply to the query.
   * @returns A record mapping the primary key to the transformed data record.
   */
  fetch(
    queryWheres?: Array<string | number>,
  ): Record<string, Record<Output, string>>;

  /**
   * Transforms a single row of an API response into a key-value tuple.
   *
   * @param result A single row from the API response.
   * @param joins A record containing pre-fetched data from any defined joins.
   * @returns A tuple where the first element is the primary key and the second
   *     is the transformed record.
   */
  transform(
    result: ReportResponse<Q>,
    joins: Q['joins'] extends undefined
      ? never
      : Record<
          keyof Q['joins'],
          Record<
            string,
            Record<
              Extract<
                Q['joins'][keyof Q['joins']],
                UnknownReportClass
              >['output'][number],
              string
            >
          >
        >,
  ): readonly [key: string, record: Record<Output, string>];
}

/**
 * Defines the interface for a factory that creates `Report` instances.
 */
export interface ReportFactoryInterface {
  /**
   * Creates an instance of a report.
   * @param reportClass The constructor of the report class to instantiate.
   * @returns An instance of the report.
   */
  create<
    Q extends QueryBuilder<Query<Params>>,
    Output extends string,
    Params extends string = Q['queryParams'][number],
    ChildReport extends ReportInterface<Q, Output> = ReportInterface<Q, Output>,
  >(
    reportClass: ReportClass<Q, Output, Params, ChildReport>,
  ): ReportInterface<Q, Output, Params>;
}

/**
 * Defines the interface for a `Report` class constructor.
 * This allows `Report` classes to be passed as arguments and instantiated
 * dynamically.
 * @template Q The query builder type for this report.
 * @template Output The names of the output fields.
 * @template Params The parameter names from the query.
 * @template ChildReport The specific `ReportInterface` implementation.
 */
export interface ReportClass<
  Q extends QueryBuilder<Query<Params>>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
  ChildReport extends ReportInterface<Q, Output> = ReportInterface<Q, Output>,
> {
  /**
   * The constructor for the report class.
   * @param api An instance of the Ads API client.
   * @param customerIds A list of customer IDs to query.
   * @param clientArgs The client arguments.
   * @param query The query builder object.
   * @param factory An instance of the report factory.
   */
  new (
    api: GoogleAdsApiInterface,
    customerIds: string[],
    clientArgs: AdsClientArgs,
    query: Q,
    factory: ReportFactoryInterface,
  ): ChildReport;
  /** The static query definition for the report. */
  query: Q;
  /** The static list of output fields for the report. */
  output: Output[];
}

/**
 * Defines the shape of a query, including its parameters and any joins.
 * @template S The string literal type for the parameters.
 */
export interface Query<S extends string> {
  /** The parameters (fields) to be selected in the query. */
  params: S;
  joins: JoinType<S>;
}
