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
} from 'dv360_api/dv360';
import { InsertionOrder } from 'dv360_api/dv360_resources';
import { BaseClientArgs, BaseClientInterface } from 'common/types';

import { ReportConstructor } from './client';

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
 * An impression report DAO.
 */
export interface ImpressionReportInterface {
  getImpressionPercentOutsideOfGeos(campaignId: string, geo: string[]): number;
}

/**
 * Defines parameters used in a report.
 */
export interface QueryReportParams {
  idType: IDType;
  id: Readonly<string>;
  startDate: Readonly<Date>;
  endDate: Readonly<Date>;
}

/**
 * Defines a client object, which is responsible for wrapping.
 */
export interface ClientInterface
  extends BaseClientInterface<ClientInterface, RuleGranularity, ClientArgs> {
  getAllInsertionOrders(): InsertionOrder[];
  getBudgetReport(args: {
    startDate: Date;
    endDate: Date;
  }): BudgetReportInterface;
}

/**
 * An agency ID and, optionally, an advertiser ID to narrow down.
 */
export interface ClientArgs extends BaseClientArgs {
  idType: IDType;
  id: Readonly<string>;
  advertisers?: typeof Advertisers;
  assignedTargetingOptions?: typeof AssignedTargetingOptions;
  campaigns?: typeof Campaigns;
  insertionOrders?: typeof InsertionOrders;
  budgetReport?: ReportConstructor<BudgetReportInterface>;
  impressionReport?: ReportConstructor<ImpressionReportInterface>;
}

/**
 * Used to determine which setting page a rule falls into.
 */
export enum RuleGranularity {
  CAMPAIGN = 'Campaign',
  INSERTION_ORDER = 'Insertion Order',
}
