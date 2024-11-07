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
 * @fileoverview Client class for DV360.
 */

import {
  Advertisers,
  AssignedTargetingOptions,
  Campaigns,
  InsertionOrders,
  LineItems,
} from 'dv360_api/dv360';
import {
  Advertiser,
  Campaign,
  InsertionOrder,
  LineItem,
} from 'dv360_api/dv360_resources';
import { newRuleBuilder } from 'common/client_helpers';

import { AbstractRuleRange } from 'common/sheet_helpers';
import {
  DefinedParameters,
  ExecutorResult,
  ParamDefinition,
  PropertyStore,
  RecordInfo,
  RuleExecutor,
  RuleExecutorClass,
  Settings,
} from 'common/types';

import { RawApiDate } from 'dv360_api/dv360_types';
import { BudgetReport, ImpressionReport, LineItemBudgetReport } from './api';
import {
  Accessors,
  BudgetReportInterface,
  ClientArgs,
  ClientInterface,
  DisplayVideoClientTypes,
  IDType,
  LineItemBudgetReportInterface,
  RuleGranularity,
  RuleParams,
} from './types';

/**
 * A new rule in SA360.
 */
export const newRule = newRuleBuilder<DisplayVideoClientTypes>() as <
  P extends DefinedParameters<P>,
>(
  p: RuleParams<P>,
) => RuleExecutorClass<DisplayVideoClientTypes>;

/**
 * Contains a `RuleContainer` along with information to instantiate it.
 *
 * This interface enables type integrity between a rule and its args.
 *
 * This is not directly callable. Use {@link newRule} to generate a
 * {@link RuleExecutorClass}.
 *
 * @param Params a key/value pair where the key is the function parameter name
 *   and the value is the human-readable name. The latter can include spaces and
 *   special characters.
 */
export interface RuleStoreEntry<
  Params extends Record<
    keyof ParamDefinition,
    ParamDefinition[keyof ParamDefinition]
  >,
> {
  /**
   * Contains a rule's metadata.
   */
  rule: RuleExecutorClass<DisplayVideoClientTypes, Params>;

  /**
   * Content in the form of {advertiserId: {paramKey: paramValue}}.
   *
   * This is the information that is passed into a `Rule` on instantiation.
   */
  args: Settings<Params>;
}

/**
 * Wrapper client around the DV360 API for testability and efficiency.
 *
 * Rather than call APIs directly, it's better to use the methods that lazy-load
 * requests, like {@link getAllInsertionOrders}.
 */
export class Client implements ClientInterface {
  private storedInsertionOrders: { [id: string]: InsertionOrder } = {};
  private storedLineItems: { [id: string]: LineItem } = {};
  private storedCampaigns: RecordInfo[] = [];
  private savedBudgetReport?: BudgetReportInterface;
  private savedLineItemBudgetReport?: LineItemBudgetReportInterface;

  readonly args: Required<ClientArgs>;
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<DisplayVideoClientTypes>;
  };

  addRule<Params extends Record<keyof Params, ParamDefinition>>(
    rule: RuleExecutorClass<DisplayVideoClientTypes>,
    settingsArray: ReadonlyArray<string[]>,
  ): ClientInterface {
    this.ruleStore[rule.definition.name] = new rule(this, settingsArray);
    return this;
  }

  constructor(
    args: Omit<ClientArgs, 'idType' | 'id'> & { advertiserId: string },
    properties: PropertyStore,
  );
  constructor(
    args: Omit<ClientArgs, 'idType' | 'id'> & { partnerId: string },
    properties: PropertyStore,
    dao?: DataAccessObject,
  );
  constructor(
    args: ClientArgs,
    properties: PropertyStore,
    dao?: DataAccessObject,
  );
  constructor(
    args: Omit<ClientArgs, 'idType' | 'id'> &
      Partial<Pick<ClientArgs, 'idType' | 'id'>> & {
        advertiserId?: string;
        partnerId?: string;
      },
    readonly properties: PropertyStore,
    readonly dao = new DataAccessObject(),
  ) {
    this.args = {
      idType:
        args.idType ?? (args.advertiserId ? IDType.ADVERTISER : IDType.PARTNER),
      id:
        args.id ??
        (args.advertiserId ? args.advertiserId : (args.partnerId ?? '')),
      label: args.label ?? `${args.idType} ${args.id}`,
    };

    this.ruleStore = {};
  }

  getRule(ruleName: string) {
    return this.ruleStore[ruleName];
  }

  /**
   * Executes each added callable rule once per call to this method.
   *
   * This function is meant to be scheduled or otherwise called
   * by the client.
   */
  async validate() {
    type Executor = RuleExecutor<DisplayVideoClientTypes>;
    const thresholds: Array<[Executor, () => Promise<ExecutorResult>]> =
      Object.values(this.ruleStore).reduce(
        (prev, rule) => {
          return [...prev, [rule, rule.run.bind(rule)]];
        },
        [] as Array<[Executor, () => Promise<ExecutorResult>]>,
      );
    const rules: Record<string, Executor> = {};
    const results: Record<string, ExecutorResult> = {};
    for (const [rule, thresholdCallable] of thresholds) {
      if (!rule.enabled) {
        results[rule.name] = { values: {} };
        rules[rule.name] = rule;
      } else {
        results[rule.name] = await thresholdCallable();
        rules[rule.name] = rule;
      }
    }

    return { rules, results };
  }

  getAllLineItems(): { [id: string]: LineItem } {
    function entries(io: LineItem) {
      return [io.getId(), io] satisfies [id: string, resource: LineItem];
    }
    if (!Object.keys(this.storedLineItems).length) {
      let lineItems: Array<[id: string, resource: LineItem]> = [];
      if (this.args.idType === IDType.ADVERTISER) {
        lineItems = this.getAllLineItemsForAdvertiser(this.args.id).map(
          entries,
        );
      } else {
        for (const { advertiserId } of this.getAllAdvertisersForPartner()) {
          for (const io of this.getAllLineItemsForAdvertiser(advertiserId)) {
            lineItems.push([io.getId(), io]);
          }
        }
      }
      this.storedLineItems = Object.fromEntries(lineItems);
    }
    return this.storedLineItems;
  }

  getAllInsertionOrders(): { [id: string]: InsertionOrder } {
    function entries(io: InsertionOrder) {
      return [io.getId(), io] satisfies [id: string, resource: InsertionOrder];
    }
    if (!Object.keys(this.storedInsertionOrders).length) {
      let insertionOrders: Array<[id: string, resource: InsertionOrder]> = [];
      if (this.args.idType === IDType.ADVERTISER) {
        insertionOrders = this.getAllInsertionOrdersForAdvertiser(
          this.args.id,
        ).map(entries);
      } else {
        for (const { advertiserId } of this.getAllAdvertisersForPartner()) {
          for (const io of this.getAllInsertionOrdersForAdvertiser(
            advertiserId,
          )) {
            insertionOrders.push([io.getId(), io]);
          }
        }
      }
      this.storedInsertionOrders = Object.fromEntries(insertionOrders);
    }
    return this.storedInsertionOrders;
  }

  async getAllCampaigns(): Promise<RecordInfo[]> {
    if (!this.storedCampaigns.length) {
      const campaignsWithSegments = Object.values(
        this.getAllInsertionOrders(),
      ).reduce((prev, io) => {
        prev.add(io.getCampaignId());
        return prev;
      }, new Set<string>());

      const result =
        this.args.idType === IDType.ADVERTISER
          ? this.getAllCampaignsForAdvertiser(this.args.id).filter((campaign) =>
              campaignsWithSegments.has(campaign.id),
            )
          : this.getAllAdvertisersForPartner().reduce(
              (arr, { advertiserId, advertiserName }) =>
                arr.concat(
                  this.getAllCampaignsForAdvertiser(
                    advertiserId,
                    advertiserName,
                  ).filter((campaign) =>
                    campaignsWithSegments.has(campaign.id),
                  ),
                ),
              [] as RecordInfo[],
            );
      this.storedCampaigns = result;
    }

    return this.storedCampaigns;
  }

  getAllAdvertisersForPartner(): Array<{
    advertiserId: string;
    advertiserName: string;
  }> {
    const cache = CacheService.getScriptCache();
    const result: Array<{ advertiserId: string; advertiserName: string }> = [];
    const advertisers = cache.get('advertisers:2');
    if (advertisers) {
      return JSON.parse(advertisers) as Array<{
        advertiserId: string;
        advertiserName: string;
      }>;
    }
    const advertiserApi = new this.dao.accessors.advertisers(this.args.id);
    advertiserApi.list((advertisers: Advertiser[]) => {
      for (const advertiser of advertisers) {
        const advertiserId = advertiser.getId();
        const advertiserName = advertiser.getDisplayName();
        if (!advertiserId) {
          throw new Error('Advertiser ID is missing.');
        }
        if (!advertiserName) {
          throw new Error('Advertiser name is missing.');
        }
        result.push({ advertiserId, advertiserName });
      }
    });
    cache.put('advertisers:2', JSON.stringify(result), 120);

    return result;
  }

  getAllLineItemsForAdvertiser(advertiserId: string): LineItem[] {
    let result: LineItem[] = [];
    const lineItemApi = new this.dao.accessors.lineItems(advertiserId);
    lineItemApi.list((lineItems: LineItem[]) => {
      result = result.concat(lineItems);
    });

    return result;
  }

  getAllInsertionOrdersForAdvertiser(advertiserId: string): InsertionOrder[] {
    let result: InsertionOrder[] = [];
    const todayDate = new Date();
    const insertionOrderApi = new this.dao.accessors.insertionOrders(
      advertiserId,
    );
    insertionOrderApi.list((ios: InsertionOrder[]) => {
      result = result.concat(
        ios.filter((io) => {
          for (const budgetSegment of io.getInsertionOrderBudgetSegments()) {
            if (getDate(budgetSegment.dateRange.endDate) > todayDate) {
              return true;
            }
          }
          return false;
        }),
      );
    });

    return result;
  }

  getAllCampaignsForAdvertiser(
    advertiserId: string,
    advertiserName?: string,
  ): RecordInfo[] {
    const result: RecordInfo[] = [];
    const campaignApi = new this.dao.accessors.campaigns(advertiserId);
    campaignApi.list((campaigns: Campaign[]) => {
      for (const campaign of campaigns) {
        const id = campaign.getId();
        if (!id) {
          throw new Error('Campaign ID is missing.');
        }
        result.push({
          advertiserId,
          ...(advertiserName ? { advertiserName } : {}),
          id,
          displayName: campaign.getDisplayName()!,
        });
      }
    });

    return result;
  }

  getBudgetReport({
    startDate,
    endDate,
  }: {
    startDate: Date;
    endDate: Date;
  }): BudgetReportInterface {
    if (!this.savedBudgetReport) {
      this.savedBudgetReport = new this.dao.accessors.budgetReport({
        idType: this.args.idType,
        id: this.args.id,
        startDate,
        endDate,
      });
    }
    return this.savedBudgetReport;
  }

  getLineItemBudgetReport({
    startDate,
    endDate,
  }: {
    startDate: Date;
    endDate: Date;
  }): LineItemBudgetReportInterface {
    if (!this.savedLineItemBudgetReport) {
      this.savedLineItemBudgetReport =
        new this.dao.accessors.lineItemBudgetReport({
          idType: this.args.idType,
          id: this.args.id,
          startDate,
          endDate,
        });
    }
    return this.savedLineItemBudgetReport;
  }

  getUniqueKey(prefix: string) {
    return `${prefix}-${this.args.idType === IDType.PARTNER ? 'P' : 'A'}${
      this.args.id
    }`;
  }
}

/**
 * Converts a {@link RawApiDate} to a {@link Date}.
 */
export function getDate(rawApiDate: RawApiDate): Date {
  return new Date(rawApiDate.year, rawApiDate.month - 1, rawApiDate.day);
}

/**
 * DV360 rule args splits.
 */
export class RuleRange extends AbstractRuleRange<DisplayVideoClientTypes> {
  private hasAdvertiserName: boolean | undefined = undefined;
  private readonly campaignMap: Record<string, RecordInfo> = {};

  async getRows(ruleGranularity: RuleGranularity) {
    if (ruleGranularity === RuleGranularity.CAMPAIGN) {
      return this.client.getAllCampaigns();
    } else if (ruleGranularity === RuleGranularity.INSERTION_ORDER) {
      return Object.values(this.client.getAllInsertionOrders()).map((io) => ({
        advertiserId: io.getAdvertiserId(),
        id: io.getId()!,
        displayName: io.getDisplayName()!,
      }));
    } else {
      return Object.values(this.client.getAllLineItems()).map((li) => ({
        advertiserId: li.getAdvertiserId(),
        id: li.getId()!,
        displayName: li.getDisplayName()!,
      }));
    }
  }

  async getRuleHeaders(): Promise<string[]> {
    const { hasAdvertiserName } = await this.getCampaignMap();
    if (!hasAdvertiserName) {
      return [];
    }
    return ['Advertiser ID', 'Advertiser Name'];
  }

  private async getCampaignMap(): Promise<{
    campaignMap: Record<string, RecordInfo>;
    hasAdvertiserName: boolean;
  }> {
    if (this.hasAdvertiserName === undefined) {
      const allCampaigns =
        (await this.client.getAllCampaigns()) as RecordInfo[];
      for (const campaign of allCampaigns) {
        this.campaignMap[campaign.id] = campaign;
      }
      this.hasAdvertiserName =
        allCampaigns[0] && allCampaigns[0].advertiserName !== undefined;
    }
    return {
      campaignMap: this.campaignMap,
      hasAdvertiserName: this.hasAdvertiserName,
    };
  }

  override async getRuleMetadata(granularity: RuleGranularity, id: string) {
    const { campaignMap, hasAdvertiserName } = await this.getCampaignMap();
    if (!hasAdvertiserName) {
      return undefined;
    }
    let campaignId: string;
    switch (granularity) {
      case RuleGranularity.CAMPAIGN:
        campaignId = id;
        break;
      case RuleGranularity.INSERTION_ORDER:
        const insertionOrders = this.client.getAllInsertionOrders();
        campaignId = insertionOrders[id] && insertionOrders[id].getCampaignId();
        break;
      case RuleGranularity.LINE_ITEM:
        const lineItems = this.client.getAllLineItems();
        campaignId = lineItems[id] && lineItems[id].getCampaignId();
        break;
      default:
        throw new Error(`Unsupported granularity "${granularity}`);
    }
    if (!campaignMap[campaignId] || !campaignId) {
      throw new Error();
    }
    return [
      campaignMap[campaignId].advertiserId,
      //checked in `hasAdvertiserName`
      campaignMap[campaignId].advertiserName!,
    ] satisfies [string, string];
  }
}

/**
 * Manages interactions between API components and the client.
 *
 * Exposed to help stub tests.
 */
export class DataAccessObject {
  constructor(
    readonly accessors: Accessors = {
      budgetReport: BudgetReport,
      lineItemBudgetReport: LineItemBudgetReport,
      impressionReport: ImpressionReport,
      advertisers: Advertisers,
      assignedTargetingOptions: AssignedTargetingOptions,
      campaigns: Campaigns,
      insertionOrders: InsertionOrders,
      lineItems: LineItems,
    },
  ) {}
}
