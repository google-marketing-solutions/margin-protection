/**
 * @license
 * Copyright 2023 Google LLC.
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

// g3-format-prettier
import {
  Advertisers,
  AssignedTargetingOptions,
  Campaigns,
  InsertionOrders,
} from 'dv360_api/dv360';
import {
  Advertiser,
  Campaign,
  InsertionOrder,
} from 'dv360_api/dv360_resources';
import {RawApiDate} from 'dv360_api/dv360_types';
import {
  PropertyStore,
  Rule,
  RuleInstructions,
} from 'anomaly_library/main';
import {
  AbstractRuleRange,
  newRuleBuilder,
} from 'common/sheet_helpers';
import {
  Callback,
  ExecutorResult,
  ParamDefinition,
  RecordInfo,
  RuleDefinition,
  RuleExecutor,
  RuleExecutorClass,
  RuleUtilities,
  Settings,
} from 'common/types';

import {BudgetReport, BudgetReportInterface, ImpressionReport} from './api';
import {
  ClientArgs,
  ClientInterface,
  IDType,
  QueryReportParams,
  RuleGranularity,
} from './types';

/**
 * A new rule in SA360.
 */
export const newRule = newRuleBuilder<
  ClientInterface,
  RuleGranularity,
  ClientArgs
>() as <P extends Record<keyof P, ParamDefinition>>(
  p: RuleParams<P>,
) => RuleExecutorClass<ClientInterface, RuleGranularity, ClientArgs, P>;

/**
 * Parameters for a rule, with `this` methods from {@link RuleUtilities}.
 */
type RuleParams<Params extends Record<keyof Params, ParamDefinition>> =
  RuleDefinition<Params, RuleGranularity> &
    ThisType<
      RuleExecutor<ClientInterface, RuleGranularity, ClientArgs, Params> &
        RuleUtilities
    >;

/**
 * A report class that can return a Report object.
 */
export interface ReportConstructor<T> {
  new (params: QueryReportParams): T;
}

/**
 * Contains a `RuleContainer` along with information to instantiate it.
 *
 * This interface enables type integrity between a rule and its settings.
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
  rule: RuleExecutorClass<ClientInterface, RuleGranularity, ClientArgs, Params>;

  /**
   * Content in the form of {advertiserId: {paramKey: paramValue}}.
   *
   * This is the information that is passed into a `Rule` on instantiation.
   */
  settings: Settings<Params>;
}

/**
 * Wrapper client around the DV360 API for testability and efficiency.
 *
 * Rather than call APIs directly, it's better to use the methods that lazy-load
 * requests, like {@link getAllInsertionOrders}.
 */
export class Client implements ClientInterface {
  private storedInsertionOrders: InsertionOrder[] = [];
  private storedCampaigns: RecordInfo[] = [];
  private savedBudgetReport?: BudgetReportInterface;

  readonly settings: Required<ClientArgs>;
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<
      ClientInterface,
      RuleGranularity,
      ClientArgs,
      Record<string, ParamDefinition>
    >;
  };

  addRule<Params extends Record<keyof Params, ParamDefinition>>(
    rule: RuleExecutorClass<
      ClientInterface,
      RuleGranularity,
      ClientArgs,
      Params
    >,
    settingsArray: readonly string[][],
  ): ClientInterface {
    this.ruleStore[rule.definition.name] = new rule(this, settingsArray);
    return this;
  }

  constructor(
    settings: Omit<ClientArgs, 'idType' | 'id'> & {advertiserId: string},
    properties: PropertyStore,
  );
  constructor(
    settings: Omit<ClientArgs, 'idType' | 'id'> & {partnerId: string},
    properties: PropertyStore,
  );
  constructor(settings: ClientArgs, properties: PropertyStore);
  constructor(
    settings: Omit<ClientArgs, 'idType' | 'id'> &
      Partial<Pick<ClientArgs, 'idType' | 'id'>> & {
        advertiserId?: string;
        partnerId?: string;
      },
    readonly properties: PropertyStore,
  ) {
    this.settings = {
      advertisers: settings.advertisers || Advertisers,
      assignedTargetingOptions:
        settings.assignedTargetingOptions || AssignedTargetingOptions,
      idType:
        settings.idType ??
        (settings.advertiserId ? IDType.ADVERTISER : IDType.PARTNER),
      id:
        settings.id ??
        (settings.advertiserId
          ? settings.advertiserId
          : settings.partnerId ?? ''),
      campaigns: settings.campaigns || Campaigns,
      insertionOrders: settings.insertionOrders || InsertionOrders,
      budgetReport: settings.budgetReport || BudgetReport,
      impressionReport: settings.impressionReport || ImpressionReport,
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
   * by the client. It relies on a rule changing state using the anomaly
   * library.
   */
  async validate() {
    type Executor = RuleExecutor<
      ClientInterface,
      RuleGranularity,
      ClientArgs,
      Record<string, ParamDefinition>
    >;
    const thresholds: Array<[Executor, Function]> = Object.values(
      this.ruleStore,
    ).reduce((prev, rule) => {
      return [...prev, [rule, rule.run.bind(rule)]];
    }, [] as Array<[Executor, Function]>);
    const rules: Record<string, Executor> = {};
    const results: Record<string, ExecutorResult> = {};
    for (const [rule, thresholdCallable] of thresholds) {
      results[rule.name] = await thresholdCallable();
      rules[rule.name] = rule;
    }

    return {rules, results};
  }

  getAllInsertionOrders(): InsertionOrder[] {
    if (!this.storedInsertionOrders.length) {
      this.storedInsertionOrders =
        this.settings.idType === IDType.ADVERTISER
          ? this.getAllInsertionOrdersForAdvertiser(this.settings.id)
          : this.getAllAdvertisersForPartner().reduce(
              (arr, advertiserId) =>
                arr.concat(
                  this.getAllInsertionOrdersForAdvertiser(advertiserId),
                ),
              [] as InsertionOrder[],
            );
    }
    return this.storedInsertionOrders;
  }

  async getAllCampaigns() {
    if (!this.storedCampaigns.length) {
      const campaignsWithSegments = this.getAllInsertionOrders().reduce(
        (prev, io) => {
          prev.add(io.getCampaignId());
          return prev;
        },
        new Set<string>(),
      );

      const result =
        this.settings.idType === IDType.ADVERTISER
          ? this.getAllCampaignsForAdvertiser(this.settings.id).filter(
              (campaign) => campaignsWithSegments.has(campaign.id),
            )
          : this.getAllAdvertisersForPartner().reduce(
              (arr, advertiserId) =>
                arr.concat(
                  this.getAllCampaignsForAdvertiser(advertiserId).filter(
                    (campaign) => campaignsWithSegments.has(campaign.id),
                  ),
                ),
              [] as RecordInfo[],
            );
      this.storedCampaigns = result;
    }

    return this.storedCampaigns;
  }

  getAllAdvertisersForPartner(): string[] {
    const cache = CacheService.getScriptCache();
    const result: string[] = [];
    const advertisers = cache.get('advertisers');
    if (advertisers) {
      return JSON.parse(advertisers) as string[];
    }
    const advertiserApi = new this.settings.advertisers(this.settings.id);
    advertiserApi.list((advertisers: Advertiser[]) => {
      for (const advertiser of advertisers) {
        const id = advertiser.getId();
        if (!id) {
          throw new Error('Advertiser ID is missing.');
        }
        result.push(id);
      }
    });
    cache.put('advertisers', JSON.stringify(result), 120);

    return result;
  }

  getAllInsertionOrdersForAdvertiser(advertiserId: string): InsertionOrder[] {
    let result: InsertionOrder[] = [];
    const todayDate = new Date();
    const insertionOrderApi = new this.settings.insertionOrders(advertiserId);
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

  getAllCampaignsForAdvertiser(advertiserId: string): RecordInfo[] {
    const result: RecordInfo[] = [];
    const campaignApi = new this.settings.campaigns(advertiserId);
    campaignApi.list((campaigns: Campaign[]) => {
      for (const campaign of campaigns) {
        const id = campaign.getId();
        if (!id) {
          throw new Error('Campaign ID is missing.');
        }
        result.push({
          advertiserId,
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
      this.savedBudgetReport = new this.settings.budgetReport({
        idType: this.settings.idType,
        id: this.settings.id,
        startDate,
        endDate,
      });
    }
    return this.savedBudgetReport;
  }

  getUniqueKey(prefix: string) {
    return `${prefix}-${this.settings.idType === IDType.PARTNER ? 'P' : 'A'}${
      this.settings.id
    }`;
  }

  newRule(
    rule: (rule: RuleInstructions) => Rule,
    instructions: Omit<RuleInstructions, 'propertyStore'>,
  ) {
    return rule({...instructions, propertyStore: this.properties});
  }
}

/**
 * Converts a {@link RawApiDate} to a {@link Date}.
 */
export function getDate(rawApiDate: RawApiDate): Date {
  return new Date(rawApiDate.year, rawApiDate.month - 1, rawApiDate.day);
}

/**
 * DV360 rule settings splits.
 */
export class RuleRange extends AbstractRuleRange<
  ClientInterface,
  RuleGranularity,
  ClientArgs
> {
  async getRows(ruleGranularity: RuleGranularity) {
    if (ruleGranularity === RuleGranularity.CAMPAIGN) {
      return this.client.getAllCampaigns();
    } else {
      return this.client.getAllInsertionOrders().map((io) => ({
        advertiserId: io.getAdvertiserId(),
        id: io.getId()!,
        displayName: io.getDisplayName()!,
      }));
    }
  }
}
