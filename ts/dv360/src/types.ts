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
 * @fileoverview This file contains the TypeScript interfaces and enums that
 * are specific to the DV360 Launch Monitor implementation. It builds upon the
 * common types to create contracts tailored for DV360 entities and logic.
 */

import {
  Advertisers,
  AssignedTargetingOptions,
  Campaigns,
  InsertionOrders,
  LineItems,
} from 'dv360_api/dv360';
import { LineItem, InsertionOrder } from 'dv360_api/dv360_resources';
import {
  BaseClientArgs,
  BaseClientInterface,
  ClientTypes,
  ParamDefinition,
  RuleDefinition,
  RuleExecutor,
  FrontendInterface,
  RecordInfo,
} from 'common/types';

/**
 * An enum to distinguish between running the tool at the Advertiser or Partner
 * level.
 */
export enum IDType {
  ADVERTISER = 1,
  PARTNER,
}

/**
 * An interface for a DAO that fetches an insertion order budget report.
 */
export interface BudgetReportInterface {
  /**
   * Gets the spend for a specific insertion order budget segment. This is lazy-
   * loaded; the report is only fetched when a value is first requested.
   *
   * @param insertionOrderId The ID of the insertion order.
   * @param startTime The start time of the budget segment in ms since epoch.
   * @param endTime The end time of the budget segment in ms since epoch.
   * @return The total spend for the segment.
   */
  getSpendForInsertionOrder(
    insertionOrderId: string,
    startTime: number,
    endTime: number,
  ): number;
}

/**
 * An interface for a DAO that fetches a line item budget report.
 */
export interface LineItemBudgetReportInterface {
  /**
   * Gets the spend for a specific line item. This is lazy-loaded.
   * @param lineItemId The ID of the line item.
   * @return The total spend for the line item.
   */
  getSpendForLineItem(lineItemId: string): number;
}

/**
 * An interface for a DAO that fetches an impression report.
 */
export interface ImpressionReportInterface {
  /**
   * Calculates the percentage of impressions served outside a given set of
   * geographic locations.
   * @param campaignId The ID of the campaign.
   * @param geo An array of allowed geo target strings.
   * @return The percentage of impressions served outside the allowed geos.
   */
  getImpressionPercentOutsideOfGeos(campaignId: string, geo: string[]): number;
}

/**
 * Defines the parameters required for fetching a query-based report.
 */
export interface QueryReportParams extends DateRange {
  /** The type of ID being used (Partner or Advertiser). */
  idType: IDType;
  /** The Partner or Advertiser ID. */
  id: Readonly<string>;
}

/**
 * Defines a date range with a start and end date.
 */
export interface DateRange {
  /** The start date of the range. */
  startDate: Readonly<Date>;
  /** The end date of the range. */
  endDate: Readonly<Date>;
}

/**
 * Defines the interface for the DV360 client, extending the base client with
 * DV360-specific methods.
 */
export interface ClientInterface
  extends BaseClientInterface<DisplayVideoClientTypes> {
  /** The Data Access Object for API and report classes. */
  dao: { accessors: Accessors };
  /** Fetches all insertion orders for the client's scope. */
  getAllInsertionOrders(): { [id: string]: InsertionOrder };
  /** Fetches all line items for the client's scope. */
  getAllLineItems(): Promise<{ [id: string]: LineItem }>;
  /** Gets an instance of the budget report DAO for a given date range. */
  getBudgetReport(args: DateRange): BudgetReportInterface;
  /** Gets an instance of the line item budget report DAO. */
  getLineItemBudgetReport(args: DateRange): LineItemBudgetReportInterface;
  /** Builds a map of campaign IDs to their metadata. */
  getCampaignMap(): Promise<{
    campaignMap: Record<string, RecordInfo>;
    hasAdvertiserName: boolean;
  }>;
}

/**
 * Defines the arguments required to initialize the DV360 client.
 */
export interface ClientArgs extends BaseClientArgs<ClientArgs> {
  /** The type of ID provided (Partner or Advertiser). */
  idType: IDType;
  /** The Partner or Advertiser ID. */
  id: Readonly<string>;
}

/**
 * An enum defining the different entity levels at which a rule can be
 * configured and executed.
 */
export enum RuleGranularity {
  CAMPAIGN = 'Campaign',
  INSERTION_ORDER = 'Insertion Order',
  LINE_ITEM = 'Line Item',
}

/**
 * A concrete implementation of the generic `ClientTypes` interface, bundling
 * all the DV360-specific types together.
 */
export interface DisplayVideoClientTypes
  extends ClientTypes<DisplayVideoClientTypes> {
  client: ClientInterface;
  ruleGranularity: RuleGranularity;
  clientArgs: ClientArgs;
  frontend: FrontendInterface<DisplayVideoClientTypes>;
}

/**
 * A type alias for DV360 rule parameters, providing the correct `this` context
 * for the rule's callback function.
 */
export type RuleParams<Params extends Record<keyof Params, ParamDefinition>> =
  RuleDefinition<DisplayVideoClientTypes, Params> &
    ThisType<RuleExecutor<DisplayVideoClientTypes, Params>>;

/**
 * An interface for a class constructor that can instantiate a report DAO.
 * @template T The type of the report DAO interface.
 */
export interface ReportConstructor<T> {
  new (params: QueryReportParams): T;
}

/**
 * A convenience interface for defining report class constructors.
 * @template CallableClass The report DAO class.
 */
interface DbmReportClass<CallableClass> {
  new (params: QueryReportParams): CallableClass;
}

/**
 * Defines the structure of the Data Access Object, which holds the
 * constructors for all the DV360 API and report classes. This allows for easy
 * dependency injection and mocking.
 */
export interface Accessors {
  /** The constructor for the `BudgetReport` class. */
  budgetReport: DbmReportClass<BudgetReportInterface>;
  lineItemBudgetReport: DbmReportClass<LineItemBudgetReportInterface>;
  impressionReport: DbmReportClass<ImpressionReportInterface>;
  advertisers: typeof Advertisers;
  assignedTargetingOptions: typeof AssignedTargetingOptions;
  campaigns: typeof Campaigns;
  insertionOrders: typeof InsertionOrders;
  lineItems: typeof LineItems;
}
