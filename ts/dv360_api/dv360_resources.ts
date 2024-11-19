/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview This file encapsulates domain object representations for DV360
 * Resources that are accessible via the DV360 API. Static mappers are
 * implemented per domain object to ensure proper separation of concerns between
 * the library's domain objects and their expected API counterparts.
 */

import {
  AdvertiserAdServerConfig,
  AdvertiserAdServerConfigMapper,
  AdvertiserGeneralConfig,
  AdvertiserGeneralConfigMapper,
  ApiDate,
  BiddingStrategy,
  BiddingStrategyMapper,
  CampaignBudget,
  CampaignBudgetMapper,
  CampaignFlight,
  CampaignFlightMapper,
  CampaignGoal,
  CampaignGoalMapper,
  FrequencyCap,
  FrequencyCapMapper,
  InsertionOrderBudget,
  InsertionOrderBudgetMapper,
  InventorySourceRateDetails,
  InventorySourceRateDetailsMapper,
  Kpi,
  KpiMapper,
  LineItemBudget,
  LineItemBudgetMapper,
  LineItemFlight,
  LineItemFlightMapper,
  LineItemPartnerRevenueModel,
  LineItemPartnerRevenueModelMapper,
  Pacing,
  PacingMapper,
  RawApiDate,
  RawStatus,
  RawTargetingType,
  Status,
  STATUS,
  StatusMapper,
  TargetingType,
  TargetingTypeMapper,
} from './dv360_types';
import { ObjectUtil } from './utils';

/** A base class for DV360 resources that are accessible via the API. */
export class DisplayVideoResource {
  /**
   * Constructs an instance of `DisplayVideoResource`.
   *
   * @param id The unique resource ID. Should be null for resources
   *     that are yet to be created by the API
   * @param displayName The display name. Can be null for certain
   *     resources
   * @param status Optional status to set
   */
  constructor(
    readonly id: string | null,
    readonly displayName: string | null,
    readonly status: Status = STATUS.UNSPECIFIED,
  ) {}

  /**
   * Compares this `DisplayVideoResource` to 'other' and returns an `Array` of
   * changed mutable properties (ID for example is immutable and cannot be
   * changed (it can only be "set" after an object has been created by the API),
   * therefore this method will not compare it between 'this' and 'other').
   * @see #getMutableProperties for a complete list of mutable properties.
   *
   * @param other The other resource to compare
   * @return An array of changed mutable properties between
   *     this and 'other'
   */
  getChangedProperties(other: DisplayVideoResource | null): string[] {
    const changedProperties = [];

    if (!other) {
      changedProperties.push(...this.getMutableProperties());
    } else {
      if (this.displayName !== other.displayName) {
        changedProperties.push('displayName');
      }
      if (this.status !== other.status) {
        changedProperties.push('entityStatus');
      }
    }
    return changedProperties;
  }

  /**
   * Compares this `DisplayVideoResource` to 'other' and returns a
   * comma-separated string of changed mutable properties.
   *
   * @param other The other resource to compare
   * @return A comma-separated string of changed mutable properties
   *     between this and 'other'
   */
  getChangedPropertiesString(other: DisplayVideoResource | null): string {
    return this.getChangedProperties(other).join(',');
  }

  /**
   * Returns all properties of this `DisplayVideoResource` that are modifiable.
   *
   * @return An array of properties that are modifiable
   */
  getMutableProperties(): string[] {
    return ['displayName', 'entityStatus'];
  }
}

interface RequiredAdvertiserParams {
  id: string | null;
  displayName: string;
  partnerId: string;
  generalConfig: AdvertiserGeneralConfig;
}

interface OptionalAdvertiserParams {
  adServerConfig?: AdvertiserAdServerConfig;
  status?: Status;
}

/**
 * An extension of `DisplayVideoResource` to represent an advertiser.
 * @see https://developers.google.com/display-video/api/reference/rest/v1/advertisers
 * @final
 */
export class Advertiser extends DisplayVideoResource {
  readonly partnerId: string;

  readonly generalConfig: AdvertiserGeneralConfig;

  readonly adServerConfig: AdvertiserAdServerConfig;

  /**
   * Constructs an instance of `Advertiser`.
   *
   */
  constructor(
    { id, displayName, partnerId, generalConfig }: RequiredAdvertiserParams,
    {
      adServerConfig = { thirdPartyOnlyConfig: {} },
      status = STATUS.ACTIVE,
    }: OptionalAdvertiserParams = {},
  ) {
    super(id, displayName, status);

    this.partnerId = partnerId;

    this.generalConfig = generalConfig;

    this.adServerConfig = adServerConfig;
  }

  /**
   * Converts a resource object returned by the API into a concrete `Advertiser`
   * instance.
   *
   * @param resource The API resource object
   * @return The concrete instance
   * @throws {!Error} If the API resource object did not contain the expected
   *     properties
   */
  static fromApiResource(resource: { [key: string]: unknown }): Advertiser {
    const requiredProperties = [
      'advertiserId',
      'displayName',
      'partnerId',
      'entityStatus',
      'generalConfig',
      'adServerConfig',
    ];
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties,
        errorOnFail: true,
      })
    ) {
      const generalConfig = resource[
        'generalConfig'
      ] as AdvertiserGeneralConfig;
      const adServerConfig = resource[
        'adServerConfig'
      ] as AdvertiserAdServerConfig;
      const mappedGeneralConfig =
        AdvertiserGeneralConfigMapper.map(generalConfig);
      const mappedAdServerConfig =
        AdvertiserAdServerConfigMapper.map(adServerConfig);

      if (mappedGeneralConfig && mappedAdServerConfig) {
        return new Advertiser(
          {
            id: String(resource['advertiserId']),
            displayName: String(resource['displayName']),
            partnerId: String(resource['partnerId']),
            generalConfig: mappedGeneralConfig,
          },
          {
            adServerConfig: mappedAdServerConfig ?? null,
            status: StatusMapper.map(resource['entityStatus'] as RawStatus),
          },
        );
      }
    }
    throw ObjectUtil.error(
      'Error! Encountered an invalid API resource object ' +
        'while mapping to an instance of Advertiser.',
    );
  }

  /**
   * Converts this instance of `Advertiser` to its expected JSON representation.
   * This method is called by default when an instance of `Advertiser` is passed
   * to `JSON.stringify`.
   *
   * @return The custom JSON representation of this
   *     `Advertiser` instance
   */
  toJSON(): { [key: string]: unknown } {
    return {
      advertiserId: this.id,
      displayName: this.displayName,
      partnerId: this.partnerId,
      entityStatus: String(this.status),
      generalConfig: this.generalConfig,
      adServerConfig: this.adServerConfig,
    };
  }

  /**
   * Compares this `Advertiser` to 'other' and returns an `Array` of changed
   * mutable properties (ID for example is immutable and cannot be changed,
   * therefore this method will not compare it between 'this' and 'other').
   * @see #getMutableProperties for a complete list of mutable properties.
   *
   * @param other The other advertiser to compare
   * @return An array of changed mutable properties between
   *     this and 'other'
   */
  override getChangedProperties(other: DisplayVideoResource | null): string[] {
    const changedProperties = super.getChangedProperties(other);

    if (
      other instanceof Advertiser &&
      this.generalConfig.domainUrl !== other.generalConfig.domainUrl
    ) {
      changedProperties.push('generalConfig.domainUrl');
    }
    return changedProperties;
  }

  /**
   * Returns all properties of this `Advertiser` that are modifiable.
   *
   * @return An array of properties that are modifiable
   */
  override getMutableProperties(): string[] {
    return [...super.getMutableProperties(), 'generalConfig.domainUrl'];
  }
}

interface CampaignRequiredParameters {
  id: string | null;
  displayName: string;
  advertiserId: string;
  campaignGoal: CampaignGoal;
  frequencyCap: FrequencyCap;
}

interface CampaignOptionalParameters {
  campaignBudgets?: CampaignBudget[];
  campaignFlight?: CampaignFlight;
  status?: Status;
}

/**
 * An extension of `DisplayVideoResource` to represent a campaign.
 * @see https://developers.google.com/display-video/api/reference/rest/v1/advertisers.campaigns
 * @final
 */
export class Campaign extends DisplayVideoResource {
  readonly advertiserId: string;

  readonly campaignGoal: CampaignGoal;

  readonly campaignFrequencyCap: FrequencyCap;

  readonly campaignFlight: CampaignFlight;

  readonly campaignBudgets: CampaignBudget[];

  /**
   * Constructs an instance of `Campaign`.
   *
   */
  constructor(
    {
      id,
      displayName,
      advertiserId,
      campaignGoal,
      frequencyCap,
    }: CampaignRequiredParameters,
    {
      campaignBudgets,
      campaignFlight = { plannedDates: { startDate: ApiDate.now().toJSON() } },
      status = STATUS.ACTIVE,
    }: CampaignOptionalParameters = {},
  ) {
    super(id, displayName, status);

    this.advertiserId = advertiserId;

    this.campaignGoal = campaignGoal;

    this.campaignFrequencyCap = frequencyCap;

    this.campaignFlight = campaignFlight;

    this.campaignBudgets = campaignBudgets || [];
  }

  /**
   * Converts a resource object returned by the API into a concrete `Campaign`
   * instance.
   *
   * @param resource The API resource object
   * @return The concrete instance
   * @throws {!Error} If the API resource object did not contain the expected
   *     properties
   */
  static fromApiResource(resource: { [key: string]: unknown }): Campaign {
    const requiredProperties = [
      'campaignId',
      'displayName',
      'advertiserId',
      'entityStatus',
      'campaignGoal',
      'campaignFlight',
      'frequencyCap',
    ];
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties,
        errorOnFail: true,
      })
    ) {
      const campaignBudgets = resource['campaignBudgets'] as CampaignBudget[];
      const campaignGoal = resource['campaignGoal'] as CampaignGoal;
      const campaignFlight = resource['campaignFlight'] as CampaignFlight;
      const frequencyCap = resource['frequencyCap'] as FrequencyCap;
      const mappedCampaignBudgets = CampaignBudgetMapper.map(campaignBudgets);
      const mappedCampaignGoal = CampaignGoalMapper.map(campaignGoal);
      const mappedCampaignFlight = CampaignFlightMapper.map(campaignFlight);
      const mappedFrequencyCap = FrequencyCapMapper.map(frequencyCap);

      if (mappedCampaignGoal && mappedCampaignFlight && mappedFrequencyCap) {
        return new Campaign(
          {
            id: String(resource['campaignId']),
            displayName: String(resource['displayName']),
            advertiserId: String(resource['advertiserId']),
            campaignGoal: mappedCampaignGoal,
            frequencyCap: mappedFrequencyCap,
          },
          {
            campaignBudgets: mappedCampaignBudgets,
            campaignFlight: mappedCampaignFlight,
            status: StatusMapper.map(
              String(resource['entityStatus']) as RawStatus,
            ),
          },
        );
      } else {
        console.debug({
          mappedCampaignGoal,
          mappedCampaignFlight,
          mappedFrequencyCap,
        });
      }
    }
    throw ObjectUtil.error(
      'Error! Encountered an invalid API resource object ' +
        'while mapping to an instance of Campaign.',
    );
  }

  /**
   * Converts this instance of `Campaign` to its expected JSON representation.
   * This method is called by default when an instance of `Campaign` is passed
   * to `JSON.stringify`.
   *
   * @return The custom JSON representation of this
   *     `Campaign` instance
   */
  toJSON(): { [key: string]: unknown } {
    return {
      campaignId: this.id,
      displayName: this.displayName,
      advertiserId: this.advertiserId,
      entityStatus: String(this.status),
      campaignBudgets: CampaignBudgetMapper.toJson(this.campaignBudgets),
      campaignGoal: this.campaignGoal,
      campaignFlight: CampaignFlightMapper.toJson(this.campaignFlight),
      frequencyCap: this.campaignFrequencyCap,
    };
  }

  /**
   * Compares this `Campaign` to 'other' and returns an `Array` of changed
   * mutable properties (ID for example is immutable and cannot be changed,
   * therefore this method will not compare it between 'this' and 'other').
   * @see #getMutableProperties for a complete list of mutable properties.
   *
   * @param other The other campaign to compare
   * @return An array of changed mutable properties between
   *     this and 'other'
   */
  override getChangedProperties(other: DisplayVideoResource | null): string[] {
    const changedProperties = super.getChangedProperties(other);
    const campaignStartDate = this.campaignFlight.plannedDates.startDate;

    if (other instanceof Campaign) {
      changedProperties.push(
        ...ApiDate.fromApiResource(campaignStartDate)!.getChangedProperties(
          campaignStartDate,
          /* prefix= */ 'campaignFlight.plannedDates.startDate.',
        ),
      );
    }
    return changedProperties;
  }

  /**
   * Returns all properties of this `Campaign` that are modifiable.
   *
   * @return An array of properties that are modifiable
   */
  override getMutableProperties(): string[] {
    return [
      ...super.getMutableProperties(),
      ...ApiDate.getMutableProperties('campaignFlight.plannedDates.startDate.'),
    ];
  }
}

interface InsertionOrderParams {
  id: string | null;
  displayName: string;
  advertiserId: string;
  campaignId: string;
  insertionOrderType: string;
  pacing: Pacing;
  frequencyCap: FrequencyCap;
  kpi: Kpi;
  budget: InsertionOrderBudget;
}

/**
 * An extension of `DisplayVideoResource` to represent an insertion order.
 * @see https://developers.google.com/display-video/api/reference/rest/v1/advertisers.insertionOrders
 * @final
 */
export class InsertionOrder extends DisplayVideoResource {
  readonly advertiserId: string;

  readonly campaignId: string;

  readonly insertionOrderType: string;

  readonly insertionOrderPacing: Pacing;

  readonly insertionOrderFrequencyCap: FrequencyCap;

  readonly insertionOrderKpi: Kpi;

  readonly insertionOrderBudget: InsertionOrderBudget;

  constructor(
    {
      id,
      displayName,
      advertiserId,
      campaignId,
      insertionOrderType,
      pacing,
      frequencyCap,
      kpi,
      budget,
    }: InsertionOrderParams,
    status: Status = STATUS.DRAFT,
  ) {
    super(id, displayName, status);

    this.advertiserId = advertiserId;

    this.campaignId = campaignId;

    this.insertionOrderType = insertionOrderType;

    this.insertionOrderPacing = pacing;

    this.insertionOrderFrequencyCap = frequencyCap;

    this.insertionOrderKpi = kpi;

    this.insertionOrderBudget = budget;
  }

  /**
   * Converts a resource object returned by the API into a concrete
   * `InsertionOrder` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance
   * @throws {!Error} If the API resource object did not contain the expected
   *     properties
   */
  static fromApiResource(resource: { [key: string]: unknown }): InsertionOrder {
    const requiredProperties = [
      'insertionOrderId',
      'displayName',
      'advertiserId',
      'campaignId',
      'insertionOrderType',
      'entityStatus',
      'pacing',
      'frequencyCap',
      'kpi',
      'budget',
    ];
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties,
        errorOnFail: true,
      })
    ) {
      const pacing = resource['pacing'] as Pacing;
      const frequencyCap = resource['frequencyCap'] as FrequencyCap;
      const kpi = resource['kpi'] as Kpi;
      const budget = resource['budget'] as InsertionOrderBudget;
      const mappedPacing = PacingMapper.map(pacing);
      const mappedFrequencyCap = FrequencyCapMapper.map(frequencyCap);
      const mappedKpi = KpiMapper.map(kpi) || {};
      const mappedBudget = InsertionOrderBudgetMapper.map(budget);

      if (mappedPacing && mappedFrequencyCap && mappedKpi && mappedBudget) {
        return new InsertionOrder(
          {
            id: String(resource['insertionOrderId']),
            displayName: String(resource['displayName']),
            advertiserId: String(resource['advertiserId']),
            campaignId: String(resource['campaignId']),
            insertionOrderType: String(resource['insertionOrderType']),
            pacing: mappedPacing,
            frequencyCap: mappedFrequencyCap,
            kpi: mappedKpi,
            budget: mappedBudget,
          },
          StatusMapper.map(resource['entityStatus'] as RawStatus),
        );
      }
    }
    throw ObjectUtil.error(
      'Error! Encountered an invalid API resource object ' +
        'while mapping to an instance of InsertionOrder.',
    );
  }

  /**
   * Converts this instance of `InsertionOrder` to its expected JSON
   * representation. This method is called by default when an instance of
   * `InsertionOrder` gets passed to `JSON.stringify`.
   *
   * @return The custom JSON representation of this
   *     `InsertionOrder` instance
   */
  toJSON(): { [key: string]: unknown } {
    return {
      insertionOrderId: this.id,
      displayName: this.displayName,
      advertiserId: this.advertiserId,
      campaignId: this.campaignId,
      insertionOrderType: this.insertionOrderType,
      entityStatus: String(this.status),
      pacing: this.insertionOrderPacing,
      frequencyCap: this.insertionOrderFrequencyCap,
      kpi: this.insertionOrderKpi,
      budget: InsertionOrderBudgetMapper.toJson(this.insertionOrderBudget),
    };
  }

  /**
   * Compares this `InsertionOrder` to 'other' and returns an `Array` of
   * changed mutable properties (ID for example is immutable and cannot be
   * changed, therefore this method will not compare it between 'this' and
   * 'other').
   * @see #getMutableProperties for a complete list of mutable properties.
   *
   * @param other The other insertion order to compare
   * @return An array of changed mutable properties between
   *     this and 'other'
   */
  override getChangedProperties(other: DisplayVideoResource | null): string[] {
    const changedProperties = super.getChangedProperties(other);

    if (other instanceof InsertionOrder) {
      if (this.insertionOrderType !== other.insertionOrderType) {
        changedProperties.push('insertionOrderType');
      }
      if (
        this.insertionOrderBudget.budgetSegments !==
        other.insertionOrderBudget.budgetSegments
      ) {
        changedProperties.push('budget.budgetSegments');
      }
    }
    return changedProperties;
  }

  /**
   * Returns all properties of this `InsertionOrder` that are modifiable.
   *
   * @return An array of properties that are modifiable
   */
  override getMutableProperties(): string[] {
    return [
      ...super.getMutableProperties(),
      'insertionOrderType',
      'budget.budgetSegments',
    ];
  }
}

interface LineItemParams {
  id: string | null;
  displayName: string;
  advertiserId: string;
  campaignId: string;
  insertionOrderId: string;
  lineItemType: string;
  flight: LineItemFlight;
  budget: LineItemBudget;
  pacing: Pacing;
  frequencyCap: FrequencyCap;
  partnerRevenueModel: LineItemPartnerRevenueModel;
  bidStrategy: BiddingStrategy;
  youtubeAndPartnersSettings?: YoutubeAndPartnersSettings;
}

interface YoutubeAndPartnersSettings {
  /** The view frequency cap settings of the line item. The max_views field in this settings object must be used if assigning a limited cap. */
  viewFrequencyCap?: FrequencyCap;
  /** Optional. The third-party measurement configs of the line item. */
  thirdPartyMeasurementConfigs?: ThirdPartyMeasurementConfigs;
  /** Settings that control what YouTube and Partners inventories the line item will target. */
  inventorySourceSettings?: YoutubeAndPartnersInventorySourceConfig;
  /** The kind of content on which the YouTube and Partners ads will be shown. */
  contentCategory?:
    | 'YOUTUBE_AND_PARTNERS_CONTENT_CATEGORY_UNSPECIFIED'
    | 'YOUTUBE_AND_PARTNERS_CONTENT_CATEGORY_STANDARD'
    | 'YOUTUBE_AND_PARTNERS_CONTENT_CATEGORY_EXPANDED'
    | 'YOUTUBE_AND_PARTNERS_CONTENT_CATEGORY_LIMITED';
  /** Output only. The content category which takes effect when serving the line item. When content category is set in both line item and advertiser, the stricter one will take effect when serving the line item. */
  effectiveContentCategory?:
    | 'YOUTUBE_AND_PARTNERS_CONTENT_CATEGORY_UNSPECIFIED'
    | 'YOUTUBE_AND_PARTNERS_CONTENT_CATEGORY_STANDARD'
    | 'YOUTUBE_AND_PARTNERS_CONTENT_CATEGORY_EXPANDED'
    | 'YOUTUBE_AND_PARTNERS_CONTENT_CATEGORY_LIMITED';
  /** Optional. The average number of times you want ads from this line item to show to the same person over a certain period of time. */
  targetFrequency?: TargetFrequency;
  leadFormId?: string;
  /** Optional. The settings related to VideoAdSequence. */
  videoAdSequenceSettings?:
    | 'VIDEO_AD_SEQUENCE_MINIMUM_DURATION_UNSPECIFIED'
    | 'VIDEO_AD_SEQUENCE_MINIMUM_DURATION_WEEK'
    | 'VIDEO_AD_SEQUENCE_MINIMUM_DURATION_MONTH';
}

export declare interface TargetFrequency {
  /** The target number of times, on average, the ads will be shown to the same person in the timespan dictated by time_unit and time_unit_count. */
  targetCount?: string;
  /** The unit of time in which the target frequency will be applied. The following time unit is applicable: * `TIME_UNIT_WEEKS` */
  timeUnit?:
    | 'TIME_UNIT_UNSPECIFIED'
    | 'TIME_UNIT_LIFETIME'
    | 'TIME_UNIT_MONTHS'
    | 'TIME_UNIT_WEEKS'
    | 'TIME_UNIT_DAYS'
    | 'TIME_UNIT_HOURS'
    | 'TIME_UNIT_MINUTES';

  /** The number of time_unit the target frequency will last. The following restrictions apply based on the value of time_unit: * `TIME_UNIT_WEEKS` - must be 1 */
  timeUnitCount?: number;
}

interface ThirdPartyMeasurementConfigs {
  /** Optional. The third-party vendors measuring viewability. The following third-party vendors are applicable: * `THIRD_PARTY_VENDOR_MOAT` * `THIRD_PARTY_VENDOR_DOUBLE_VERIFY` * `THIRD_PARTY_VENDOR_INTEGRAL_AD_SCIENCE` * `THIRD_PARTY_VENDOR_COMSCORE` * `THIRD_PARTY_VENDOR_TELEMETRY` * `THIRD_PARTY_VENDOR_MEETRICS` */
  viewabilityVendorConfigs?: ThirdPartyVendorConfig[];
  /** Optional. The third-party vendors measuring brand safety. The following third-party vendors are applicable: * `THIRD_PARTY_VENDOR_ZERF` * `THIRD_PARTY_VENDOR_DOUBLE_VERIFY` * `THIRD_PARTY_VENDOR_INTEGRAL_AD_SCIENCE` */
  brandSafetyVendorConfigs?: ThirdPartyVendorConfig[];
  /** Optional. The third-party vendors measuring reach. The following third-party vendors are applicable: * `THIRD_PARTY_VENDOR_NIELSEN` * `THIRD_PARTY_VENDOR_COMSCORE` * `THIRD_PARTY_VENDOR_KANTAR` */
  reachVendorConfigs?: ThirdPartyVendorConfig[];
  /** Optional. The third-party vendors measuring brand lift. The following third-party vendors are applicable: * `THIRD_PARTY_VENDOR_DYNATA` * `THIRD_PARTY_VENDOR_KANTAR` */
  brandLiftVendorConfigs?: ThirdPartyVendorConfig[];
}

interface ThirdPartyVendorConfig {
  vendor:
    | 'THIRD_PARTY_VENDOR_UNSPECIFIED'
    | 'THIRD_PARTY_VENDOR_MOAT'
    | 'THIRD_PARTY_VENDOR_DOUBLE_VERIFY'
    | 'THIRD_PARTY_VENDOR_INTEGRAL_AD_SCIENCE'
    | 'THIRD_PARTY_VENDOR_COMSCORE'
    | 'THIRD_PARTY_VENDOR_TELEMETRY'
    | 'THIRD_PARTY_VENDOR_MEETRICS'
    | 'THIRD_PARTY_VENDOR_ZEFR'
    | 'THIRD_PARTY_VENDOR_NIELSEN'
    | 'THIRD_PARTY_VENDOR_KANTAR'
    | 'THIRD_PARTY_VENDOR_DYNATA';
  placementId: string;
}

export interface YoutubeAndPartnersInventorySourceConfig {
  /** Optional. Whether to target inventory on YouTube. This includes both search, channels and videos. */
  includeYoutube?: boolean;
  /** Optional. Whether to target inventory in video apps available with Google TV. */
  includeGoogleTv?: boolean;
  /** Whether to target inventory on a collection of partner sites and apps that follow the same brand safety standards as YouTube. */
  includeYoutubeVideoPartners?: boolean;
}

/**
 * An extension of `DisplayVideoResource` to represent a line item.
 * @see https://developers.google.com/display-video/api/reference/rest/v1/advertisers.lineItems
 * @final
 */
export class LineItem extends DisplayVideoResource {
  readonly advertiserId: string;

  readonly campaignId: string;

  readonly insertionOrderId: string;

  readonly lineItemType: string;

  readonly lineItemFlight: LineItemFlight;

  readonly lineItemBudget: LineItemBudget;

  readonly lineItemPacing: Pacing;

  readonly lineItemFrequencyCap: FrequencyCap;

  readonly lineItemPartnerRevenueModel: LineItemPartnerRevenueModel;

  readonly lineItemBidStrategy: BiddingStrategy;

  constructor(
    {
      id,
      displayName,
      advertiserId,
      campaignId,
      insertionOrderId,
      lineItemType,
      flight,
      budget,
      pacing,
      partnerRevenueModel,
      bidStrategy,
      frequencyCap,
    }: LineItemParams,
    status: Status = STATUS.DRAFT,
  ) {
    super(id, displayName, status);

    this.advertiserId = advertiserId;

    this.campaignId = campaignId;

    this.insertionOrderId = insertionOrderId;

    this.lineItemType = lineItemType;

    this.lineItemFlight = flight;

    this.lineItemBudget = budget;

    this.lineItemPacing = pacing;

    this.lineItemFrequencyCap = frequencyCap;

    this.lineItemPartnerRevenueModel = partnerRevenueModel;

    this.lineItemBidStrategy = bidStrategy;
  }

  /**
   * Converts a resource object returned by the API into a concrete `LineItem`
   * instance.
   *
   * @param resource The API resource object
   * @return The concrete instance
   * @throws {!Error} If the API resource object did not contain the expected
   *     properties
   */
  static fromApiResource(resource: { [key: string]: unknown }): LineItem {
    const requiredProperties = [
      'lineItemId',
      'displayName',
      'advertiserId',
      'campaignId',
      'insertionOrderId',
      'lineItemType',
      'entityStatus',
      'flight',
      'budget',
      'pacing',
      'partnerRevenueModel',
      'bidStrategy',
    ];
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties,
        errorOnFail: true,
      })
    ) {
      const flight = resource['flight'] as LineItemFlight;
      const budget = resource['budget'] as LineItemBudget;
      const pacing = resource['pacing'] as Pacing;
      const frequencyCap =
        resource['frequencyCap'] ||
        (resource['youtubeAndPartnersSettings'][
          'viewFrequencyCap'
        ] as FrequencyCap);
      const partnerRevenueModel = resource[
        'partnerRevenueModel'
      ] as LineItemPartnerRevenueModel;
      const bidStrategy = resource['bidStrategy'] as BiddingStrategy;
      const mappedFlight = LineItemFlightMapper.map(flight);
      const mappedBudget = LineItemBudgetMapper.map(budget);
      const mappedPacing = PacingMapper.map(pacing);
      const mappedFrequencyCap = FrequencyCapMapper.map(frequencyCap);
      const mappedPartnerRevenueModel =
        LineItemPartnerRevenueModelMapper.map(partnerRevenueModel);
      const mappedBidStrategy = BiddingStrategyMapper.map(bidStrategy);

      if (
        mappedFlight &&
        mappedBudget &&
        mappedPacing &&
        mappedPartnerRevenueModel &&
        mappedBidStrategy
      ) {
        return new LineItem(
          {
            id: String(resource['lineItemId']),
            displayName: String(resource['displayName']),
            advertiserId: String(resource['advertiserId']),
            campaignId: String(resource['campaignId']),
            insertionOrderId: String(resource['insertionOrderId']),
            lineItemType: String(resource['lineItemType']),
            flight: mappedFlight,
            budget: mappedBudget,
            pacing: mappedPacing,
            frequencyCap: mappedFrequencyCap,
            partnerRevenueModel: mappedPartnerRevenueModel,
            bidStrategy: mappedBidStrategy,
          },
          StatusMapper.map(resource['entityStatus'] as RawStatus),
        );
      }
    }
    throw ObjectUtil.error(
      'Error! Encountered an invalid API resource object ' +
        'while mapping to an instance of LineItem.',
    );
  }

  /**
   * Converts this instance of `LineItem` to its expected JSON representation.
   * This method is called by default when an instance of `LineItem` gets passed
   * to `JSON.stringify`.
   *
   * @return The custom JSON representation of this
   *     `LineItem` instance
   */
  toJSON(): { [key: string]: unknown } {
    return {
      lineItemId: this.id,
      displayName: this.displayName,
      advertiserId: this.advertiserId,
      campaignId: this.campaignId,
      insertionOrderId: this.insertionOrderId,
      lineItemType: this.lineItemType,
      entityStatus: String(this.status),
      flight: LineItemFlightMapper.toJson(this.lineItemFlight),
      budget: this.lineItemBudget,
      pacing: this.lineItemPacing,
      frequencyCap: this.lineItemFrequencyCap,
      partnerRevenueModel: this.lineItemPartnerRevenueModel,
      bidStrategy: this.lineItemBidStrategy,
    };
  }

  /**
   * Compares this `LineItem` to 'other' and returns an `Array` of changed
   * mutable properties (ID for example is immutable and cannot be changed,
   * therefore this method will not compare it between 'this' and 'other').
   * @see #getMutableProperties for a complete list of mutable properties.
   *
   * @param other The other line item to compare
   * @return An array of changed mutable properties between
   *     this and 'other'
   */
  override getChangedProperties(other: DisplayVideoResource | null): string[] {
    const changedProperties = super.getChangedProperties(other);

    if (other instanceof LineItem && this.lineItemFlight.dateRange.endDate) {
      changedProperties.push(
        ...ApiDate.fromApiResource(
          this.lineItemFlight.dateRange.endDate!,
        )!.getChangedProperties(
          other.lineItemFlight.dateRange.endDate,
          /* prefix= */ 'flight.dateRange.endDate.',
        ),
      );
    }
    return changedProperties;
  }

  /**
   * Returns all properties of this `LineItem` that are modifiable.
   *
   * @return An array of properties that are modifiable
   */
  override getMutableProperties(): string[] {
    return [
      ...super.getMutableProperties(),
      ...ApiDate.getMutableProperties('flight.dateRange.endDate.'),
    ];
  }

  /**
   * Returns the line item flight end date, or null if a date object doesn't
   * exist.
   *
   */
  getLineItemFlightEndDate(): RawApiDate | null {
    return this.lineItemFlight.dateRange
      ? this.lineItemFlight.dateRange!.endDate
      : null;
  }
}

interface InventorySourceParams {
  id: string;
  displayName: string;
  inventorySourceType: string;
  rateDetails: InventorySourceRateDetails;
}

interface InventorySourceOptionalParams {
  commitment?: string | null;
  deliveryMethod?: string | null;
  dealId?: string | null;
  publisherName?: string | null;
  exchange?: string | null;
  status?: Status;
}

/**
 * An extension of `DisplayVideoResource` to represent an inventory source.
 * @see https://developers.google.com/display-video/api/reference/rest/v1/inventorySources
 * @final
 */
export class InventorySource extends DisplayVideoResource {
  readonly inventorySourceType: string;

  readonly rateDetails: InventorySourceRateDetails;

  readonly commitment: string | null;

  readonly deliveryMethod: string | null;

  readonly dealId: string | null;

  readonly publisherName: string | null;

  readonly exchange: string | null;

  constructor(
    {
      id,
      displayName,
      inventorySourceType,
      rateDetails,
    }: InventorySourceParams,
    {
      commitment = null,
      deliveryMethod = null,
      dealId = null,
      publisherName = null,
      exchange = null,
      status = STATUS.ACTIVE,
    }: InventorySourceOptionalParams = {},
  ) {
    super(id, displayName, status);

    this.inventorySourceType = inventorySourceType;

    this.rateDetails = rateDetails;

    this.commitment = commitment;

    this.deliveryMethod = deliveryMethod;

    this.dealId = dealId;

    this.publisherName = publisherName;

    this.exchange = exchange;
  }

  /**
   * Converts a resource object returned by the API into a concrete
   * `InventorySource` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance
   * @throws {!Error} If the API resource object did not contain the expected
   *     properties
   */
  static fromApiResource(resource: {
    [key: string]: unknown;
  }): InventorySource {
    const requiredProperties = [
      'inventorySourceId',
      'displayName',
      'inventorySourceType',
      'rateDetails',
      'status',
    ];
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties,
        errorOnFail: true,
      })
    ) {
      const status = resource['status'] as { entityStatus?: RawStatus };
      const rateDetails = resource['rateDetails'] as InventorySourceRateDetails;
      const mappedRateDetails =
        InventorySourceRateDetailsMapper.map(rateDetails);

      if (
        mappedRateDetails &&
        ObjectUtil.hasOwnProperties(status, {
          requiredProperties: ['entityStatus'],
          errorOnFail: true,
        })
      ) {
        const requiredParams = {
          id: String(resource['inventorySourceId']),
          displayName: String(resource['displayName']),
          inventorySourceType: String(resource['inventorySourceType']),
          rateDetails: mappedRateDetails,
        };
        const optionalParams: InventorySourceOptionalParams = {
          status: StatusMapper.map(status.entityStatus!),
        };
        if (resource['commitment']) {
          optionalParams.commitment = resource['commitment'] as string;
        }
        if (resource['deliveryMethod']) {
          optionalParams.deliveryMethod = resource['deliveryMethod'] as string;
        }
        if (resource['dealId']) {
          optionalParams.dealId = resource['dealId'] as string;
        }
        if (resource['publisherName']) {
          optionalParams.publisherName = resource['publisherName'] as string;
        }
        if (resource['exchange']) {
          optionalParams.exchange = resource['exchange'] as string;
        }
        return new InventorySource(requiredParams, optionalParams);
      }
    }
    throw ObjectUtil.error(
      'Error! Encountered an invalid API resource object ' +
        'while mapping to an instance of InventorySource.',
    );
  }

  /**
   * Converts this instance of `InventorySource` to its expected JSON
   * representation. This method is called by default when an instance of
   * `InventorySource` gets passed to `JSON.stringify`.
   *
   * @return The custom
   *     JSON representation of this `InventorySource` instance
   */
  toJSON(): { [key: string]: unknown } {
    const result: { [key: string]: unknown } = {
      inventorySourceId: this.id,
      displayName: this.displayName,
      inventorySourceType: this.inventorySourceType,
      rateDetails: this.rateDetails,
      status: { entityStatus: String(this.status) },
    };
    if (this.commitment) {
      result['commitment'] = this.commitment;
    }
    if (this.deliveryMethod) {
      result['deliveryMethod'] = this.deliveryMethod;
    }
    if (this.dealId) {
      result['dealId'] = this.dealId;
    }
    if (this.publisherName) {
      result['publisherName'] = this.publisherName;
    }
    if (this.exchange) {
      result['exchange'] = this.exchange;
    }
    return result;
  }

  override getChangedProperties(): string[] {
    return [];
  }

  override getMutableProperties(): string[] {
    return [];
  }
}

/**
 * An extension of `DisplayVideoResource` to represent a targeting option.
 * @see https://developers.google.com/display-video/api/reference/rest/v1/targetingTypes.targetingOptions
 */
export class TargetingOption extends DisplayVideoResource {
  readonly targetingDetails: { [key: string]: unknown };
  /**
   * Constructs an instance of `TargetingOption`.
   *
   * @param id The unique resource ID
   * @param targetingType The targeting type for this targeting
   *     option
   * @param targetingDetailsKey The property name for the targeting
   *     details object associated with this targeting option
   * @param targetingDetails The targeting details
   *     object, which may contain a 'displayName' property
   * @param idProperty Optional name of the ID property. Defaults to
   *     'targetingOptionId'
   */
  constructor(
    id: string | null,
    readonly targetingType: TargetingType,
    readonly targetingDetailsKey: string,
    targetingDetails: { [key: string]: unknown },
    readonly idProperty: string = 'targetingOptionId',
  ) {
    super(
      id /* displayName= */,
      targetingDetails['displayName']
        ? String(targetingDetails['displayName'])
        : null,
    );

    this.targetingDetails = targetingDetails;
  }

  /**
   * Converts a resource object returned by the API into a concrete
   * `TargetingOption` instance.
   *
   * @param resource The API resource object
   * @param additionalProperties Optional additional
   *     properties. Defaults to an empty array
   * @param idProperty Optional id property to use. Defaults to
   *     'targetingOptionId'
   * @param type Optional type to use for logging. Defaults to
   *     'TargetingOption'
   * @return The concrete instance
   * @throws {!Error} If the API resource object did not contain the expected
   *     properties
   */
  static fromApiResource(
    resource: { [key: string]: unknown },
    additionalProperties: string[] = [],
    idProperty: string = 'targetingOptionId',
    type: string = 'TargetingOption',
  ): TargetingOption {
    const requiredProperties = [
      'targetingType',
      idProperty,
      ...additionalProperties,
    ];

    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties,
        errorOnFail: true,
      })
    ) {
      const keys = Object.keys(resource).filter(
        (key) => ![...requiredProperties, 'name'].includes(key),
      );

      if (keys.length === 1) {
        const targetingDetailsKey = keys[0];
        const targetingDetails = resource[targetingDetailsKey];

        if (ObjectUtil.isObject(targetingDetails)) {
          return new TargetingOption(
            String(resource[idProperty]),
            TargetingTypeMapper.map(
              resource['targetingType'] as RawTargetingType,
            )!,
            targetingDetailsKey,
            targetingDetails as { [key: string]: unknown },
          );
        }
      }
    }
    throw ObjectUtil.error(
      'Error! Encountered an invalid API resource object ' +
        `while mapping to an instance of ${type}.`,
    );
  }

  /**
   * Converts this instance of `TargetingOption` to its expected JSON
   * representation. This method is called by default when an instance of
   * `TargetingOption` gets passed to `JSON.stringify`.
   *
   * @return The custom JSON representation of this
   *     `TargetingOption` instance
   */
  toJSON(): { [key: string]: unknown } {
    const result: { [key: string]: unknown } = {
      targetingType: this.targetingType,
    };
    result[this.targetingDetailsKey] = this.targetingDetails;
    result[this.idProperty] = this.id;

    return result;
  }

  override getChangedProperties(): string[] {
    return [];
  }

  override getMutableProperties(): string[] {
    return [];
  }
}

/**
 * An extension of `DisplayVideoResource` to represent an assigned targeting
 * option. It is either assigned to an `Advertiser`, `Campaign`,
 * `InsertionOrder` or `LineItem`.
 * @see https://developers.google.com/display-video/api/reference/rest/v1/advertisers.targetingTypes.assignedTargetingOptions
 * @see https://developers.google.com/display-video/api/reference/rest/v1/advertisers.campaigns.targetingTypes.assignedTargetingOptions
 * @see https://developers.google.com/display-video/api/reference/rest/v1/advertisers.insertionOrders.targetingTypes.assignedTargetingOptions
 * @see https://developers.google.com/display-video/api/reference/rest/v1/advertisers.lineItems.targetingTypes.assignedTargetingOptions
 * @final
 */
export class AssignedTargetingOption extends TargetingOption {
  /**
   * Constructs an instance of `AssignedTargetingOption`.
   *
   * @param id The unique resource ID
   * @param targetingType The targeting type for this targeting
   *     option
   * @param inheritance Indicates whether the assigned targeting option
   *     is inherited from a higher level entity
   * @param targetingDetailsKey The property name for the assigned
   *     targeting details object associated with this targeting option
   * @param targetingDetails The targeting details object
   *     which may contain a 'displayName' property
   */
  constructor(
    id: string | null,
    targetingType: TargetingType,
    readonly inheritance: string,
    targetingDetailsKey: string,
    targetingDetails: { [key: string]: unknown },
  ) {
    super(
      id,
      targetingType,
      targetingDetailsKey,
      targetingDetails,
      'assignedTargetingOptionId',
    );
  }

  /**
   * Converts a resource object returned by the API into a concrete
   * `AssignedTargetingOption` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance
   * @throws {!Error} If the API resource object did not contain the expected
   *     properties
   */
  static override fromApiResource(resource: {
    [key: string]: unknown;
  }): AssignedTargetingOption {
    const targetingOption = TargetingOption.fromApiResource(
      resource,
      /* additionalProperties= */ ['inheritance'],
      /* idProperty= */ 'assignedTargetingOptionId',
      /* type= */ 'AssignedTargetingOption',
    );
    return new AssignedTargetingOption(
      targetingOption.id as string,
      targetingOption.targetingType,
      String(resource['inheritance']),
      targetingOption.targetingDetailsKey,
      targetingOption.targetingDetails,
    );
  }

  /**
   * Converts this instance of `AssignedTargetingOption` to its expected JSON
   * representation. This method is called by default when an instance of
   * `AssignedTargetingOption` gets passed to `JSON.stringify`.
   *
   * @return The custom JSON representation of this
   *     `AssignedTargetingOption` instance
   */
  override toJSON(): { [key: string]: unknown } {
    const result = super.toJSON();
    result['inheritance'] = this.inheritance;

    return result;
  }
}
