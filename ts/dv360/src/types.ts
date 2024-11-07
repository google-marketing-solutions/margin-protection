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
 * @fileoverview Types for DV360
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
} from 'common/types';

/**
 * Defines the type of ID set on the client.
 *
 * Can only be one of advertiser or partner.
 */
export enum IDType {
  ADVERTISER = 1,
  PARTNER,
}

/**
 * A budget report DAO.
 */
export interface BudgetReportInterface {
  /**
   * Gets the spend for the specific insertion order budget segment. Lazy
   * loaded.
   * @param insertionOrderId
   * @param startTime The time in seconds since epoch
   * @param endTime The time in seconds since epoch
   */
  getSpendForInsertionOrder(
    insertionOrderId: string,
    startTime: number,
    endTime: number,
  ): number;
}

/**
 * A budget DAO report for Line Items.
 */
export interface LineItemBudgetReportInterface {
  /**
   * Gets the spend for the specific line item. Lazy loaded.
   * @param lineItemId
   */
  getSpendForLineItem(lineItemId: string): number;
}

/**
 * An impression report DAO.
 */
export interface ImpressionReportInterface {
  getImpressionPercentOutsideOfGeos(campaignId: string, geo: string[]): number;
}

/**
 * Defines parameters used in a report.
 */
export interface QueryReportParams extends DateRange {
  idType: IDType;
  id: Readonly<string>;
}

/**
 * Defines a start and end date range for reports.
 */
export interface DateRange {
  startDate: Readonly<Date>;
  endDate: Readonly<Date>;
}

/**
 * Defines a client object, which is responsible for wrapping.
 */
export interface ClientInterface
  extends BaseClientInterface<DisplayVideoClientTypes> {
  dao: { accessors: Accessors };
  getAllInsertionOrders(): { [id: string]: InsertionOrder };
  getAllLineItems(): { [id: string]: LineItem };
  getBudgetReport(args: DateRange): BudgetReportInterface;
  getLineItemBudgetReport(args: DateRange): LineItemBudgetReportInterface;
}

/**
 * An agency ID and, optionally, an advertiser ID to narrow down.
 */
export interface ClientArgs extends BaseClientArgs<ClientArgs> {
  idType: IDType;
  id: Readonly<string>;
}

/**
 * sed to determine which setting page a rule falls into.
 */
export enum RuleGranularity {
  CAMPAIGN = 'Campaign',
  INSERTION_ORDER = 'Insertion Order',
  LINE_ITEM = 'Line Item',
}

/**
 * Represents the related interfaces for DV360.
 */
export interface DisplayVideoClientTypes
  extends ClientTypes<DisplayVideoClientTypes> {
  client: ClientInterface;
  ruleGranularity: RuleGranularity;
  clientArgs: ClientArgs;
  frontend: FrontendInterface<DisplayVideoClientTypes>;
}

/**
 * Parameters for a rule, with `this` methods from {@link RuleUtilities}.
 */
export type RuleParams<Params extends Record<keyof Params, ParamDefinition>> =
  RuleDefinition<DisplayVideoClientTypes, Params> &
    ThisType<RuleExecutor<DisplayVideoClientTypes, Params>>;

/**
 * A report class that can return a Report object.
 */
export interface ReportConstructor<T> {
  new (params: QueryReportParams): T;
}

/**
 * Convenience interface for defining report classes.
 */
interface DbmReportClass<CallableClass> {
  new (params: QueryReportParams): CallableClass;
}

/**
 * Used in a DAO to wrap access objects.
 */
export interface Accessors {
  budgetReport: DbmReportClass<BudgetReportInterface>;
  lineItemBudgetReport: DbmReportClass<LineItemBudgetReportInterface>;
  impressionReport: DbmReportClass<ImpressionReportInterface>;
  advertisers: typeof Advertisers;
  assignedTargetingOptions: typeof AssignedTargetingOptions;
  campaigns: typeof Campaigns;
  insertionOrders: typeof InsertionOrders;
  lineItems: typeof LineItems;
}
