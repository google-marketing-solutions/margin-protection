/**
 * @license
 * Copyright 2023 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {getRule} from 'anomaly_library/main';
import {transformToParamValues} from 'common/sheet_helpers';
import {ClientInterface} from 'sa360/src/types';
import {CampaignInfo, ClientArgs, IDType, ParamDefinition, RuleDefinition, RuleExecutor, RuleUtilities, Settings} from 'common/types';

/**
 * Parameters for a rule, with `this` methods from {@link RuleUtilities}.
 */
type RuleParams<Params extends Record<keyof Params, ParamDefinition>> =
    RuleDefinition<Params>&ThisType<RuleExecutor<Params>&RuleUtilities>;

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
    Params extends
        Record<keyof ParamDefinition, ParamDefinition[keyof ParamDefinition]>> {
  /**
   * Contains a rule's metadata.
   */
  rule: RuleExecutorClass<Params>;
  /**
   * Content in the form of {advertiserId: {paramKey: paramValue}}.
   *
   * This is the information that is passed into a `Rule` on instantiation.
   */
  settings: Settings<Params>;
}

/**
 * An executable rule.
 */
export interface RuleExecutorClass<P extends Record<keyof P, P[keyof P]>> {
  new(client: ClientInterface, settings: readonly string[][]): RuleExecutor<P>;
  definition: RuleDefinition<P>;
}

/**
 * Creates new rule with the metadata needed to generate settings.
 *
 * Wrapping in this function gives us access to all methods in {@link
 * RuleUtilities} as part of `this` in our `callback`.
 *
 * Example:
 *
 * ```
 * newRule({
 *   //...
 *   callback(client, settings) {
 *     const rule = this.getRule(); // the `RuleGetter`
 *     const rule = rule.getValues();
 *     //...
 *   }
 * });
 * ```
 */
export function
newRule<ParamMap extends Record<keyof ParamMap, ParamDefinition>>(
    ruleDefinition: RuleParams<ParamMap>): RuleExecutorClass<ParamMap> {
  const ruleClass = class {
    readonly uniqueKeyPrefix: string = '';
    readonly settings: Settings<Record<keyof ParamMap, string>>;
    readonly name: string = ruleDefinition.name;
    readonly params = ruleDefinition.params;
    readonly helper = ruleDefinition.helper ?? '';
//Auto-added to unblock TS5.0 migration
// @ts-ignore(go/ts50upgrade): This syntax requires an imported helper named '__setFunctionName' which does not exist in 'tslib'. Consider upgrading your version of 'tslib'.
    static definition = ruleDefinition;

    constructor(readonly client: ClientInterface, settingsArray: readonly string[][]) {
      this.uniqueKeyPrefix = ruleDefinition.uniqueKeyPrefix;
      this.settings = transformToParamValues(settingsArray, this.params);
    }

    run() {
      return ruleDefinition.callback.bind(this)(this.client, this.settings);
    }

    getRule() {
      return getRule(this.getUniqueKey());
    }

    getUniqueKey() {
      return `${ruleDefinition.uniqueKeyPrefix}-${this.client.idType === IDType.AGENCY ? 'P': 'A'}${this.client.id}`;
    }

    /**
     * Executes each the rule once per call to this method.
     *
     * This should not be used when checking multiple rules. Instead, use
     * {@link Client.validate} which serves the same purpose but is able to
     * combine rules.
     */
    validate() {
      const thresholdResult = this.run();
      const threshold = thresholdResult();
      threshold.rule.saveValues(threshold.values);
    }
  };

  Object.defineProperty(ruleClass, 'name', {value: ruleDefinition.name});
  return ruleClass;
}

/**
 * Wrapper client around the DV360 API for testability and effiency.
 *
 * Any methods that are added as wrappers to the API should pool requests, either
 * through caching or some other method.
 */
export class Client implements ClientInterface {
  readonly idType: IDType;
  readonly id: string;
  readonly ruleStore:
      {[ruleName: string]: RuleExecutor<Record<string, ParamDefinition>>;};

  constructor(settings: Omit<ClientArgs, 'idType'|'id'> & {advertiserId: string});
  constructor(settings: Omit<ClientArgs, 'idType'|'id'> & {agencyId: string});
  constructor(settings: ClientArgs);
  constructor(settings: Omit<ClientArgs, 'idType'|'id'> & Partial<Pick<ClientArgs, 'idType'|'id'>> &
              {advertiserId?: string, agencyId?: string}) {
    if (!settings.advertiserId && !settings.agencyId && (!settings.id || settings.idType === undefined)) {
      throw new Error(
          'Unexpected lack of a agencyID and advertiserID. Choose one.');
    }
    this.idType = settings.idType ?? settings.advertiserId ? IDType.ADVERTISER : IDType.AGENCY;
    this.id = settings.id ??
        (settings.advertiserId ? settings.advertiserId : settings.agencyId ?? '');
    this.ruleStore = {};
  }

  /**
   * Adds a rule to be checked by `this.validate()`.
   *
   * These rules are called whenever `this.validate()` is called, and added to
   * state.
   *
   */
  addRule<Params extends Record<keyof Params, ParamDefinition>>(
      rule: RuleExecutorClass<Params>, settingsArray: readonly string[][]) {
    this.ruleStore[rule.definition.name] = new rule(this, settingsArray);
    return this;
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
  validate() {
    const thresholds: Function[] = Object.values(this.ruleStore).reduce((prev, rule) => {
      return [...prev, rule.run()];
    }, [] as Function[]);
    for (const thresholdCallable of thresholds) {
      const threshold = thresholdCallable();
      threshold.rule.saveValues(threshold.values);
    }
  }

  getAllCampaigns(): CampaignInfo[] {
    const cache = CacheService.getScriptCache();
    const cacheName = `campaigns-${this.idType}-${this.id}`;

    const campaigns = cache.get(cacheName);
    if (campaigns) {
      return JSON.parse(campaigns) as CampaignInfo[];
    }
    const result = this.idType === IDType.ADVERTISER ?
      this.getAllCampaignsForAdvertiser(this.id) :
      this.getAllAdvertisersForAgency().reduce(
        (arr, advertiserId) =>
            arr.concat(this.getAllCampaignsForAdvertiser(advertiserId)),
        [] as CampaignInfo[]);

    cache.put(cacheName, JSON.stringify(result), 60);

    return result;
  }

  getAllAdvertisersForAgency(): string[] {
    const cache = CacheService.getScriptCache();
    const result: string[] = [];
    const advertisers = cache.get('advertisers');
    if (advertisers) {
      return JSON.parse(advertisers) as string[];
    }


    return result;
  }

  getAllCampaignsForAdvertiser(advertiserId: string): CampaignInfo[] {
    const result: CampaignInfo[] = [];

    return result;
  }
}
