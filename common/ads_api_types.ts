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
 * @fileoverview Ads API-specific types for SA360 and Google Ads
 */

import { BaseClientArgs } from './types';

/**
 * Manages query (input) and expected output pairs for each report type.
 *
 * This is a non-generic version of QueryBuilder
 */
export interface NonGenericQueryBuilder {
  queryParams: readonly string[];
  queryFrom: string;
  joins?: Record<string, unknown>;
}

/**
 * A response row from the query API.
 */
export declare interface AdsSearchResponse<T> {
  nextPageToken?: string;
  results?: T[];
}

/**
 * A request object for the query API.
 */
export declare interface AdsSearchRequest {
  pageSize: number;
  query: string;
  customerId?: string;
  pageToken?: string;
}

/**
 * A report output.
 */
export type ArrayToUnion<S extends string[]> = S[number];

/**
 * The user-provided tree of known Ads accounts to run a report against.
 */
export interface AccountMap {
  /**
   * The customer ID of the Google Ads account. The root node should always
   * contain a login customer ID.
   */
  readonly customerId: string;
  /** Expands reporting for child accounts. Overrides `children`. */
  expand?: boolean;
  /**
   * Restricts reporting to a subset of child accounts. If empty, defaults to
   * expanding all leaves, maybe just this node.
   */
  children?: AccountMap[];
}

/**
 * Ads-specific minimum requirements for client arguments.
 */
export interface AdsClientArgs extends BaseClientArgs<AdsClientArgs> {
  loginCustomerId?: string;
  customerIds: string;
}

/**
 * Converts underscores to camel case.
 *
 * Example:
 *   const transformed: CamelCase<'my_id'> = 'myId';
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
 * A raw type literal that effectively forces objects to be const.
 */
export type TypeLiteral<S, T> = S extends T ? (T extends S ? never : S) : never;

/**
 * A string literal is a string constant. Avoids requiring `const`.
 */
export type StringLiteral<S extends string> = TypeLiteral<S, string>;

/**
 * Converts dots to an object.
 *
 * Example:
 *   const transformed: DotsToObject<'a.b.c'> = {'a': {'b': {'c': string } } };
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
 * Converts a report format to the expected response output.
 */
export type ReportResponse<
  Q extends QueryBuilder<P, J>,
  P extends string = Q['queryParams'][number],
  J extends JoinType<P> | undefined = Q['joins'],
> = UnionToIntersection<DotsToObject<Q['queryParams'][number]>> & {};

/**
 * Helper method to turn a union into an intersection.
 *
 * Turns a|b|c into a & b & c.
 */
export type UnionToIntersection<U> = (
  U extends object ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : object;

/**
 * Google Ads API interface
 */
export declare interface GoogleAdsApiInterface {
  /**
   * Runs a query agains the Google Ads API.
   *
   * @param customerIds A comma separated list of customer IDs to query.
   * @param query The query to run (a {@link QueryBuilder} type).
   * @param queryWheres Optional list of WHERE clauses to filter the results.
   */
  query<
    Q extends QueryBuilder<Params, Joins>,
    Params extends string = Q['queryParams'][number],
    Joins extends JoinType<Params> | undefined = Q['joins'],
  >(
    customerIds: string,
    query: Q,
    queryWheres?: string[],
  ): IterableIterator<ReportResponse<Q>>;
}

/**
 * Ad report format
 *
 * Allows generic handling of reports.
 */
export declare interface AdsReportType<
  Output extends string[],
  RecordFormat extends Record<
    keyof RecordFormat,
    RecordFormat[keyof RecordFormat]
  >,
> {
  output: Output;
  format: RecordFormat;
}

/**
 * Helper function to create a report type with less verbosity.
 *
 * This is used as the parameter for {@link ReportClass#query} and
 * fetches data in {@link GoogleAdsApiInterface#query}.
 */
export function buildQuery<
  Params extends string,
  Joins extends JoinType<Params> | undefined = undefined,
>(args: {
  queryParams: ReadonlyArray<StringLiteral<Params>>;
  queryFrom: string;
  queryWheres?: string[];
  joins?: Joins;
}): QueryBuilder<StringLiteral<Params>, Joins> {
  return args;
}

/**
 * Represents an Ads API response type.
 */
export interface RecursiveRecord<K, V> {
  [key: string]: RecursiveRecord<K, V> | V;
}

/**
 * Represents an "any-" type {@link ReportClass} for containers.
 */
// We don't know what will be in a report class.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnknownReportClass = ReportClass<any, any, any>;

/**
 * Mappings from parameters to a report class.
 *
 * This is a subset of parameters in a report, and could be empty.
 * Implementations of this should allow undefined values to simplify
 * user definitions of queries that don't require any joins (most of them).
 */
export type JoinType<Params extends string> = Partial<{
  [key in Exclude<CamelCase<Params>, ''>]: UnknownReportClass;
}>;

/**
 * Represents the parts of an ad report query.
 *
 * The query is broken out into parts, with optional filters (WHERE).
 * Also includes a "JOINS" concept for use by the Report classes in order to
 * simplify business logic.
 */
export interface QueryBuilder<
  Params extends string,
  Joins extends JoinType<Params> | undefined = undefined,
> {
  queryParams: readonly Params[];
  queryFrom: string;
  queryWheres?: string[];
  joins?: Joins;
}

/**
 * A report used to retrieve data from the API.
 */
export interface ReportInterface<
  Q extends QueryBuilder<Params, Joins>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
  Joins extends JoinType<Params> | undefined = Q['joins'],
> {
  /**
   * Returns the full report based on the results of the object.
   *
   * Optional filter is used for smart joins and for user input.
   */
  fetch(
    queryWheres?: Array<string | number>,
  ): Record<string, Record<Output, string>>;

  /**
   * Does a row-by-row transformation and returns a tuple of key to record.
   *
   * This should be transformed into a string to be maximally compatible with
   * web output (e.g. Google Sheets).
   *
   * @param result A row of the report being pulled.
   * @param joins A key/value pair of any joins. These are all pre-fetched.
   *   They can be accessed by using the report class's "name" parameter.
   */
  transform(
    result: ReportResponse<Q>,
    joins: Joins extends undefined
      ? never
      : Record<
          keyof Joins,
          Record<
            string,
            Record<
              Extract<Joins[keyof Joins], UnknownReportClass>['output'][number],
              string
            >
          >
        >,
  ): readonly [key: string, record: Record<Output, string>];
}

/**
 * A factory for creating {@link Report}s.
 */
export interface ReportFactoryInterface {
  create<
    Q extends QueryBuilder<Params, Joins>,
    Output extends string,
    Params extends string,
    Joins extends JoinType<Params> | undefined,
    ChildReport extends ReportInterface<
      Q,
      Output,
      Params,
      Joins
    > = ReportInterface<Q, Output, Params, Joins>,
  >(
    reportClass: ReportClass<Q, Output, Params, Joins, ChildReport>,
  ): ReportInterface<Q, Output, Params, Joins>;
}

/**
 * Report class - represents the class that gets the {@link Report} object.
 */
export interface ReportClass<
  Q extends QueryBuilder<Params, Joins>,
  Output extends string,
  Params extends string = Q['queryParams'][number],
  Joins extends JoinType<Params> | undefined = Q['joins'],
  ChildReport extends ReportInterface<
    Q,
    Output,
    Params,
    Joins
  > = ReportInterface<Q, Output, Params, Joins>,
> {
  new (
    api: GoogleAdsApiInterface,
    customerIds: string[],
    clientArgs: AdsClientArgs,
    query: Q,
    factory: ReportFactoryInterface,
  ): ChildReport;
  query: Q;
  output: Output[];
}
