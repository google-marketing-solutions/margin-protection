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
 * @fileoverview This file encapsulates type definitions for subtypes of DV360
 * Resources that are accessible via the DV360 API. The bare minimum of all
 * required properties is implemented; refer to the API reference linked per
 * type for an exhaustive and up-to-date list of properties.
 */

import { ObjectUtil } from './utils';

/**
 * Defines the `*Mapper` contract.
 *
 * There are two scenarios:
 *
 * 1. Map a simple resource (what you get in is what you get out, unless there's an error).
 * 2. Map a resource to an internal representation with {@link InOut}.
 */
interface Mapper<T> {
  map(
    resource: T extends InOut<infer I, unknown> ? I : T,
  ): (T extends InOut<unknown, infer O> ? O : T) | undefined;
}

/**
 * A mapper with JSON definitions.
 *
 * Not all `*Mapper` objects have JSON output. This mostly just inverts `map`.
 * "Mostly" because it's untested at this time, so shouldn't be relied on.
 */
interface MapperWithJsonOut<T> extends Mapper<T> {
  toJson(
    resource: T extends InOut<unknown, infer O> ? O : T,
  ): T extends InOut<infer I, unknown> ? I : T;
}

/**
 * Some mappers have a different "in" and "out" type. This type supports that.
 */
type InOut<InType, OutType> = [InType, OutType];

/**
 * Defines possible statuses for a DV360 resource.
 */
// Note: using `as const` in favor of `enum` here because it's a bit cleaner
// to type enforce, and even modern typescript recommended.
export const STATUS = {
  ACTIVE: 'ENTITY_STATUS_ACTIVE',
  ARCHIVED: 'ENTITY_STATUS_ARCHIVED',
  DELETED: 'ENTITY_STATUS_SCHEDULED_FOR_DELETION',
  DRAFT: 'ENTITY_STATUS_DRAFT',
  PAUSED: 'ENTITY_STATUS_PAUSED',
  UNSPECIFIED: 'ENTITY_STATUS_UNSPECIFIED',
} as const;

/**
 * The canonical TargetingType sent to the API
 */
export type Status = EnumLikeTypeCheck<typeof STATUS>;

/**
 * A union of the keys and values available to {@link STATUS}.
 */
export type RawStatus = Status | keyof typeof STATUS;

/**
 * Exports a mapper from an API resource to `Status`
 */
// tslint:disable-next-line:enforce-name-casing Legacy from JS migration
export const StatusMapper: MapperWithJsonOut<InOut<RawStatus, Status>> = {
  /**
   * Converts a raw status string to a concrete `Status`. Returns
   * `Status.UNSPECIFIED` for null inputs or unknown status values.
   *
   * @param rawStatus The raw status to convert. Can be nullable
   * @return The concrete `Status`
   */
  map(rawStatus: RawStatus): Status {
    if (rawStatus) {
      const status = rawStatus.replace(
        'ENTITY_STATUS_',
        '',
      ) as keyof typeof STATUS;
      return STATUS[status] || STATUS.UNSPECIFIED;
    }
    return STATUS.UNSPECIFIED;
  },

  toJson(resource: RawStatus) {
    return resource;
  },
};

/**
 * Defines possible targeting types for a DV360 targeting option.
 */
// Note: using `as const` in favor of `enum` here because it's a bit cleaner
// to type enforce, and even modern typescript recommended.
export const TARGETING_TYPE = {
  CHANNEL: 'TARGETING_TYPE_CHANNEL',
  GEO_REGION: 'TARGETING_TYPE_GEO_REGION',
  UNSPECIFIED: 'TARGETING_TYPE_UNSPECIFIED',
} as const;

/**
 * The canonical TargetingType sent to the API.
 */
export type TargetingType = EnumLikeTypeCheck<typeof TARGETING_TYPE>;

/**
 * A union of the keys and values available to {@link TARGETING_TYPE}.
 */
export type RawTargetingType = keyof typeof TARGETING_TYPE | TargetingType;

/**
 * Exports a mapper from an API resource to `TargetingType`.
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const TargetingTypeMapper: MapperWithJsonOut<
  InOut<RawTargetingType, TargetingType>
> = {
  /**
   * Converts a raw targeting type string to a concrete `TargetingType`. Returns
   * `TargetingType.UNSPECIFIED` for null inputs or unknown values.
   *
   * @param rawType The raw targeting type to convert. Can be nullable
   * @return The concrete `TargetingType`
   */
  map(rawType) {
    if (rawType) {
      const type = rawType.replace(
        'TARGETING_TYPE_',
        '',
      ) as keyof typeof TARGETING_TYPE;
      return TARGETING_TYPE[type] || TARGETING_TYPE.UNSPECIFIED;
    }
    return TARGETING_TYPE.UNSPECIFIED;
  },
  toJson(resource) {
    return resource;
  },
};

/**
 * Defines possible line item types.
 */
export const LINE_ITEM_TYPE = {
  UNSPECIFIED: 'LINE_ITEM_TYPE_UNSPECIFIED',
  DISPLAY_DEFAULT: 'LINE_ITEM_TYPE_DISPLAY_DEFAULT',
  DISPLAY_MOBILE_APP_INSTALL: 'LINE_ITEM_TYPE_DISPLAY_MOBILE_APP_INSTALL',
  VIDEO_DEFAULT: 'LINE_ITEM_TYPE_VIDEO_DEFAULT',
  VIDEO_MOBILE_APP_INSTALL: 'LINE_ITEM_TYPE_VIDEO_MOBILE_APP_INSTALL',
  DISPLAY_MOBILE_APP_INVENTORY: 'LINE_ITEM_TYPE_DISPLAY_MOBILE_APP_INVENTORY',
  VIDEO_MOBILE_APP_INVENTORY: 'LINE_ITEM_TYPE_VIDEO_MOBILE_APP_INVENTORY',
  AUDIO_DEFAULT: 'LINE_ITEM_TYPE_AUDIO_DEFAULT',
  VIDEO_OVER_THE_TOP: 'LINE_ITEM_TYPE_VIDEO_OVER_THE_TOP',
  YOUTUBE_AND_PARTNERS_ACTION: 'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_ACTION',
  YOUTUBE_AND_PARTNERS_NON_SKIPPABLE:
    'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_NON_SKIPPABLE',
  YOUTUBE_AND_PARTNERS_VIDEO_SEQUENCE:
    'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_VIDEO_SEQUENCE',
  YOUTUBE_AND_PARTNERS_AUDIO: 'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_AUDIO',
  YOUTUBE_AND_PARTNERS_REACH: 'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_REACH',
  YOUTUBE_AND_PARTNERS_SIMPLE: 'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_SIMPLE',
  YOUTUBE_AND_PARTNERS_NON_SKIPPABLE_OVER_THE_TOP:
    'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_NON_SKIPPABLE_OVER_THE_TOP',
  YOUTUBE_AND_PARTNERS_REACH_OVER_THE_TOP:
    'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_REACH_OVER_THE_TOP',
  YOUTUBE_AND_PARTNERS_SIMPLE_OVER_THE_TOP:
    'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_SIMPLE_OVER_THE_TOP',
  YOUTUBE_AND_PARTNERS_TARGET_FREQUENCY:
    'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_TARGET_FREQUENCY',
  YOUTUBE_AND_PARTNERS_VIEW: 'LINE_ITEM_TYPE_YOUTUBE_AND_PARTNERS_VIEW',
  DISPLAY_OUT_OF_HOME: 'LINE_ITEM_TYPE_DISPLAY_OUT_OF_HOME',
  VIDEO_OUT_OF_HOME: 'LINE_ITEM_TYPE_VIDEO_OUT_OF_HOME',
};

/**
 * Type wrapper for LINE_ITEM_TYPE.
 */
export type LineItemType = EnumLikeTypeCheck<typeof LINE_ITEM_TYPE>;

/**
 * Defines possible line item flight date types.
 */
export const LINE_ITEM_FLIGHT_DATE_TYPE = {
  UNSPECIFIED: 'LINE_ITEM_FLIGHT_DATE_TYPE_UNSPECIFIED',
  INHERITED: 'LINE_ITEM_FLIGHT_DATE_TYPE_INHERITED',
  CUSTOM: 'LINE_ITEM_FLIGHT_DATE_TYPE_CUSTOM',
};

/**
 * Type wrapper for LINE_ITEM_FLIGHT_DATE_TYPE.
 */
export type LineItemFlightDateType = EnumLikeTypeCheck<
  typeof LINE_ITEM_FLIGHT_DATE_TYPE
>;

/**
 * Defines possible pacing periods for spending ad budgets.
 */
export const PACING_PERIOD = {
  DAILY: 'PACING_PERIOD_DAILY',
  FLIGHT: 'PACING_PERIOD_FLIGHT',
  UNSPECIFIED: 'PACING_PERIOD_UNSPECIFIED',
} as const;

/**
 * The canonical PacingPeriod.
 */
export type PacingPeriod = EnumLikeTypeCheck<typeof PACING_PERIOD>;

/**
 * A union of the keys and values available to {@link PACING_PERIOD}.
 */
export type RawPacingPeriod = keyof typeof PACING_PERIOD | PacingPeriod;

/**
 * Defines possible pacing types for flights.
 *
 * As of November 5, 2024, ASAP will be unavailable for IOs.
 * It will still be available for Line Items.
 */
export const PACING_TYPE = {
  ASAP: 'PACING_TYPE_ASAP',
  AHEAD: 'PACING_TYPE_AHEAD',
  EVEN: 'PACING_TYPE_EVEN',
  UNSPECIFIED: 'PACING_TYPE_UNSPECIFIED',
} as const;

/**
 * The canonical PacingType.
 */
export type PacingType = EnumLikeTypeCheck<typeof PACING_TYPE>;

/**
 * Exports a mapper from an API resource to `PacingPeriod`.
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const PacingPeriodMapper: MapperWithJsonOut<
  InOut<RawPacingPeriod, PacingPeriod>
> = {
  /*
   * Converts a raw pacing period string to a concrete `PacingPeriod`.
   *
   * @param rawType The raw pacing period to convert. Can be nullable
   * @return The concrete `PacingPeriod`, or null for unknown
   *     or erroneous values
   */
  map(rawType: string | null) {
    if (rawType) {
      const type =
        PACING_PERIOD[
          rawType.replace('PACING_PERIOD_', '') as keyof typeof PACING_PERIOD
        ];
      return type ?? undefined;
    }
    return undefined;
  },

  toJson(resource) {
    return resource;
  },
};

/**
 * Defines frequency cap configuration for limiting display of ads.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/FrequencyCap
 *
 */
export interface FrequencyCap {
  unlimited?: boolean;
  timeUnit?: string;
  timeUnitCount?: number;
  maxImpressions?: number;
}

/**
 * Exports a mapper from an API resource to `FrequencyCap`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const FrequencyCapMapper: Mapper<FrequencyCap> = {
  /**
   * Converts a resource object returned by the API into a concrete
   * `FrequencyCap` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the resource
   *     did not contain the expected properties
   */
  map(resource) {
    if (
      resource &&
      ((typeof resource.unlimited === 'boolean' && resource.unlimited) ||
        (ObjectUtil.hasOwnProperties(resource, {
          requiredProperties: ['timeUnit', 'timeUnitCount', 'maxImpressions'],
        }) &&
          Number.isInteger(resource.timeUnitCount) &&
          Number.isInteger(resource.maxImpressions)))
    ) {
      return resource;
    }
    return undefined;
  },
};

/**
 * Defines the pacing configuration for spending ad budgets.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/Pacing
 *
 */
export interface Pacing {
  pacingPeriod: PacingPeriod;
  pacingType: PacingType;
  dailyMaxMicros?: string;
  dailyMaxImpressions?: string;
}

/**
 * Exports a mapper from an API resource to `Pacing`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const PacingMapper: Mapper<Pacing> = {
  /**
   * Converts a resource object returned by the API into a concrete `Pacing`
   * instance.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the resource did not
   *     contain the expected properties
   */
  map(resource) {
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties: ['pacingPeriod', 'pacingType'],
      })
    ) {
      const pacingPeriod = resource.pacingPeriod;
      const mappedPacingPeriod = PacingPeriodMapper.map(
        pacingPeriod as RawPacingPeriod,
      );

      if (
        mappedPacingPeriod &&
        (mappedPacingPeriod !== PACING_PERIOD.DAILY ||
          ObjectUtil.hasOwnProperties(resource, {
            oneOf: ['dailyMaxMicros', 'dailyMaxImpressions'],
          }))
      ) {
        return resource;
      }
    }
    return undefined;
  },
};

/**
 * Defines a performance goal configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/PerformanceGoal
 *
 */
export interface PerformanceGoal {
  /** Should always be set, but for legacy reasons is optional. */
  performanceGoalType?: string;
  performanceGoalAmountMicros?: string;
  performanceGoalPercentageMicros?: string;
  performanceGoalString?: string;
}

/**
 * Defines a performance goal configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/PerformanceGoal
 *
 */
export interface Kpi {
  /** Should always be set, but for legacy reasons is optional. */
  kpiType?: string;
  kpiAmountMicros?: string;
  kpiPercentageMicros?: string;
  kpiString?: string;
}

/**
 * Exports a mapper from an API resource to `PerformanceGoal`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const PerformanceGoalMapper: Mapper<PerformanceGoal> = {
  /**
   * Converts a resource object returned by the API into a concrete
   * `PerformanceGoal` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the resource
   *     did not contain the expected properties
   */
  map(resource) {
    if (
      ObjectUtil.hasOwnProperties(resource, {
        oneOf: [
          'performanceGoalAmountMicros',
          'performanceGoalPercentageMicros',
          'performanceGoalString',
        ],
      }) &&
      Object.keys(resource).length >= 1
    ) {
      if (!resource.performanceGoalType) {
        resource.performanceGoalType = 'PERFORMANCE_GOAL_TYPE_UNSPECIFIED';
      }
      if (Object.keys(resource).length === 2) {
        return resource;
      }
    }
    return undefined;
  },
};

/**
 * Possible key performance indicator (KPI) types.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers.insertionOrders#kpitype
 */
export const KPI_TYPE = {
  UNSPECIFIED: 'KPI_TYPE_UNSPECIFIED',
  CPM: 'KPI_TYPE_CPM',
  CPC: 'KPI_TYPE_CPC',
  CPA: 'KPI_TYPE_CPA',
  CTR: 'KPI_TYPE_CTR',
  VIEWABILITY: 'KPI_TYPE_VIEWABILITY',
  CPIAVC: 'KPI_TYPE_CPIAVC',
  CPE: 'KPI_TYPE_CPE',
  CPV: 'KPI_TYPE_CPV',
  CLICK_CVR: 'KPI_TYPE_CLICK_CVR',
  IMPRESSION_CVR: 'KPI_TYPE_IMPRESSION_CVR',
  VCPM: 'KPI_TYPE_VCPM',
  VTR: 'KPI_TYPE_VTR',
  AUDIO_COMPLETION_RATE: 'KPI_TYPE_AUDIO_COMPLETION_RATE',
  VIDEO_COMPLETION_RATE: 'KPI_TYPE_VIDEO_COMPLETION_RATE',
  CPCL: 'KPI_TYPE_CPCL',
  CPCV: 'KPI_TYPE_CPCV',
  TOS10: 'KPI_TYPE_TOS10',
  MAXIMIZE_PACING: 'KPI_TYPE_MAXIMIZE_PACING',
  CUSTOM_IMPRESSION_VALUE_OVER_COST:
    'KPI_TYPE_CUSTOM_IMPRESSION_VALUE_OVER_COST',
  OTHER: 'KPI_TYPE_OTHER',
};

/**
 * Possible key performance indicator (KPI) types.
 */
export type KpiType = EnumLikeTypeCheck<typeof KPI_TYPE>;

/**
 * Exports a mapper from an API resource to `PerformanceGoal`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const KpiMapper: Mapper<Kpi> = {
  /**
   * Converts a resource object returned by the API into a concrete
   * `PerformanceGoal` instance.
   *
   * @param resource The API resource object
   *
   * @return The concrete instance, or null if the resource
   *     did not contain the expected properties
   */
  map(resource) {
    if (resource.kpiType === KPI_TYPE.CPV) {
      return resource;
    }
    if (
      ObjectUtil.hasOwnProperties(resource, {
        oneOf: ['kpiAmountMicros', 'kpiPercentageMicros', 'kpiString'],
      }) &&
      Object.keys(resource).length >= 1
    ) {
      if (!resource.kpiType) {
        resource.kpiType = 'KPI_TYPE_UNSPECIFIED';
      }
      if (Object.keys(resource).length === 2) {
        return resource;
      }
    }
    return undefined;
  },
};
/**
 * Defines a maximum spend oriented bidding strategy.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/BiddingStrategy#maximizespendbidstrategy
 *
 */
interface MaxSpendBiddingStrategy {
  performanceGoalType: string;
  maxAverageCpmBidAmountMicros?: string;
  customBiddingAlgorithmId?: string;
}

/**
 * Defines a performance goal oriented bidding strategy.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/BiddingStrategy#performancegoalbidstrategy
 *
 */
interface PerformanceGoalBiddingStrategy {
  performanceGoalAmountMicros: string;
  performanceGoalType: string;
  maxAverageCpmBidAmountMicros?: string;
  customBiddingAlgorithmId?: string;
}

interface YoutubeAndPartnersBiddingStrategy {
  type: YoutubeAndPartnersBiddingStrategyType;
  value: string;
  adGroupEffectiveTargetCpaValue: string;
  adGroupEffectiveTargetCpaSource: BiddingSource;
}

/**
 * Defines configuration that determines the bid price.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/BiddingStrategy
 */
export interface BiddingStrategy {
  fixedBid?: { bidAmountMicros: string };
  maximizeSpendAutoBid?: MaxSpendBiddingStrategy;
  performanceGoalAutoBid?: PerformanceGoalBiddingStrategy;
  youtubeAndPartnersBid?: YoutubeAndPartnersBiddingStrategy;
}

/**
 * Possible types of bidding strategy for YouTube and Partners resources.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/BiddingStrategy#youtubeandpartnersbiddingstrategytype
 */
export type YoutubeAndPartnersBiddingStrategyType =
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_UNSPECIFIED'
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_MANUAL_CPV'
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_MANUAL_CPM'
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_TARGET_CPA'
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_TARGET_CPM'
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_RESERVE_CPM'
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_MAXIMIZE_LIFT'
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_MAXIMIZE_CONVERSIONS'
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_TARGET_CPV'
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_TARGET_ROAS'
  | 'YOUTUBE_AND_PARTNERS_BIDDING_STRATEGY_TYPE_MAXIMIZE_CONVERSION_VALUE';

/**
 * Source of the bidding value.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/BiddingStrategy#biddingsource
 */
export type BiddingSource =
  | 'BIDDING_SOURCE_UNSPECIFIED'
  | 'BIDDING_SOURCE_LINE_ITEM'
  | 'BIDDING_SOURCE_AD_GROUP';

/**
 * Exports a mapper from an API resource to `BiddingStrategy`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const BiddingStrategyMapper: Mapper<BiddingStrategy> = {
  /**
   * Converts a resource object returned by the API into a concrete
   * `BiddingStrategy` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the resource
   *     did not contain the expected properties
   */
  map(resource) {
    if (
      ObjectUtil.hasOwnProperties(resource, {
        oneOf: [
          'youtubeAndPartnersBid',
          'fixedBid',
          'maximizeSpendAutoBid',
          'performanceGoalAutoBid',
        ],
      })
    ) {
      const fixedBidStrategy = resource.fixedBid;
      const maxSpendStrategy = resource.maximizeSpendAutoBid;
      const performanceGoalStrategy = resource.performanceGoalAutoBid;
      const youtubeAndPartnersBid = resource.youtubeAndPartnersBid;

      const validFixedBidStrategy =
        fixedBidStrategy &&
        ObjectUtil.hasOwnProperties(fixedBidStrategy, {
          requiredProperties: ['bidAmountMicros'],
        });
      const validMaxSpendStrategy =
        maxSpendStrategy &&
        ObjectUtil.hasOwnProperties(maxSpendStrategy, {
          requiredProperties: ['performanceGoalType'],
        });
      const validYoutubeAndPartnersBid =
        youtubeAndPartnersBid &&
        ObjectUtil.hasOwnProperties(youtubeAndPartnersBid, {
          requiredProperties: ['type'],
        });
      const validPerformanceGoalStrategy =
        performanceGoalStrategy &&
        ObjectUtil.hasOwnProperties(performanceGoalStrategy, {
          requiredProperties: [
            'performanceGoalType',
            'performanceGoalAmountMicros',
          ],
        });

      if (
        validFixedBidStrategy ||
        validMaxSpendStrategy ||
        validPerformanceGoalStrategy ||
        validYoutubeAndPartnersBid
      ) {
        return resource;
      }
    }
    return undefined;
  },
};

/**
 * Defines general configuration for advertisers.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers#advertisergeneralconfig
 *
 */
export interface AdvertiserGeneralConfig {
  domainUrl: string;
  currencyCode: string;
}

/**
 * Exports a mapper from an API resource to `AdvertiserGeneralConfig`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const AdvertiserGeneralConfigMapper: Mapper<AdvertiserGeneralConfig> = {
  /**
   * Converts a resource object returned by the API into a concrete
   * `AdvertiserGeneralConfig` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the
   *     resource did not contain the expected properties
   */
  map(resource) {
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties: ['domainUrl', 'currencyCode'],
      })
    ) {
      return resource;
    }
    return undefined;
  },
};

interface ThirdPartyOnlyConfig {
  pixelOrderIdReportingEnabled?: boolean;
}

interface CMHybridConfig {
  cmAccountId: string;
  cmFloodlightConfigId: string;
  cmFloodlightLinkingAuthorized: boolean;
}

/**
 * Defines ad server configuration for advertisers.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers#advertiseradserverconfig
 *
 */
export interface AdvertiserAdServerConfig {
  thirdPartyOnlyConfig?: ThirdPartyOnlyConfig;
  cmHybridConfig?: CMHybridConfig;
}

/**
 * Exports a mapper from an API resource to `AdvertiserAdServerConfig`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const AdvertiserAdServerConfigMapper: Mapper<AdvertiserAdServerConfig> =
  {
    /**
     * Converts a resource object returned by the API into a concrete
     * `AdvertiserAdServerConfig` instance.
     *
     * @param resource The API resource object
     * @return The concrete instance, or null if the
     *     resource did not contain the expected properties
     */
    map(resource) {
      if (
        ObjectUtil.hasOwnProperties(resource, {
          oneOf: ['thirdPartyOnlyConfig', 'cmHybridConfig'],
        })
      ) {
        const thirdPartyOnlyConfig = resource.thirdPartyOnlyConfig;
        const cmHybridConfig = resource.cmHybridConfig;

        let validThirdPartyOnlyConfig =
          ObjectUtil.isObject(thirdPartyOnlyConfig);

        if (validThirdPartyOnlyConfig) {
          const thirdPartyOnlyConfigKeys = Object.keys(
            thirdPartyOnlyConfig as { [key: string]: unknown },
          );

          validThirdPartyOnlyConfig =
            thirdPartyOnlyConfigKeys.length === 0 ||
            (thirdPartyOnlyConfigKeys.length === 1 &&
              ObjectUtil.hasOwnProperties(thirdPartyOnlyConfig, {
                requiredProperties: ['pixelOrderIdReportingEnabled'],
              }) &&
              thirdPartyOnlyConfig !== undefined &&
              thirdPartyOnlyConfig.pixelOrderIdReportingEnabled !== undefined &&
              typeof thirdPartyOnlyConfig.pixelOrderIdReportingEnabled ===
                'boolean');
        }
        const validCmHybridConfig =
          ObjectUtil.hasOwnProperties(cmHybridConfig, {
            requiredProperties: [
              'cmAccountId',
              'cmFloodlightConfigId',
              'cmFloodlightLinkingAuthorized',
            ],
          }) &&
          cmHybridConfig !== undefined &&
          typeof cmHybridConfig.cmFloodlightLinkingAuthorized === 'boolean';

        if (validThirdPartyOnlyConfig || validCmHybridConfig) {
          return resource;
        }
      }
      return undefined;
    },
  };

/**
 * Defines a campaign's budget configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers.campaigns#CampaignBudget
 *
 */
export interface CampaignBudget {
  budgetId: string;
  displayName: string;
  budgetUnit: string;
  budgetAmountMicros: string;
  dateRange: { startDate: RawApiDate; endDate: RawApiDate };
}

/**
 * Maps the API resource into an interface of type `CampaignBudgetMapper`.
 */
/**
 * Exports a mapper from an API resource to `CampaignBudget[]`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const CampaignBudgetMapper: MapperWithJsonOut<CampaignBudget[]> = {
  /**
   * Converts a resource object returned by the API into a concrete
   * `CampaignBudget` instance with the current budget.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the
   *     resource did not contain the expected properties
   */
  map(resource: CampaignBudget[]) {
    if (!Array.isArray(resource)) {
      return [];
    }
    const budgets = [];
    const requiredProperties = [
      'budgetId',
      'displayName',
      'budgetUnit',
      'budgetAmountMicros',
      'dateRange',
    ];

    for (const budget of resource) {
      if (ObjectUtil.hasOwnProperties(budget, { requiredProperties })) {
        const startDateExists = ApiDate.validate(budget.dateRange.startDate);
        const endDateExists = ApiDate.validate(budget.dateRange.endDate);

        if (startDateExists && endDateExists) {
          budgets.push(budget);
        }
      } else {
        console.warn(
          Object.keys(budget),
          'does not match expected',
          requiredProperties,
        );
      }
    }
    return budgets;
  },

  /**
   * Converts an `Array<CampaignBudget>` to its expected JSON representation.
   *
   * @param budgets The budgets to convert
   * @return The custom JSON representation of the
   *     `CampaignBudget`
   */
  toJson(budgets) {
    return budgets.map((budget) => ({
      budgetId: budget.budgetId,
      displayName: budget.displayName,
      budgetUnit: budget.budgetUnit,
      budgetAmountMicros: budget.budgetAmountMicros,
      dateRange: {
        startDate: budget.dateRange.startDate,
        endDate: budget.dateRange.endDate,
      },
    }));
  },
};

/**
 * Defines a campaign's flight configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers.campaigns#campaignflight
 *
 */
export interface CampaignFlight {
  plannedDates: { startDate: RawApiDate };
}

/**
 * Maps the API resource into an interface of type `CampaignFlightMapper`.
 */
/**
 * Exports a mapper from an API resource to `CampaignFlight`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const CampaignFlightMapper: MapperWithJsonOut<CampaignFlight> = {
  /*
   * Converts a resource object returned by the API into a concrete
   * `CampaignFlight` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the resource
   *     did not contain the expected properties
   */
  map(resource) {
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties: ['plannedDates'],
      }) &&
      ObjectUtil.hasOwnProperties(resource.plannedDates, {
        requiredProperties: ['startDate'],
      })
    ) {
      const startDateValid = ApiDate.validate(
        resource.plannedDates['startDate'],
      );

      if (startDateValid) {
        return resource as unknown as CampaignFlight;
      }
    }
    return undefined;
  },

  /**
   * Converts a `CampaignFlight` to its expected JSON representation.
   *
   * @param flight The flight to convert
   * @return The custom JSON representation of the
   *     `CampaignFlight`
   */
  toJson(flight) {
    return { plannedDates: { startDate: flight.plannedDates.startDate } };
  },
};

/**
 * Defines a campaign's goal configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers.campaigns#campaigngoal
 *
 */
export interface CampaignGoal {
  campaignGoalType: string;
  performanceGoal: PerformanceGoal;
}

/**
 * Exports a mapper from an API resource to `CampaignGoal`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const CampaignGoalMapper: Mapper<CampaignGoal> = {
  /*
   * Converts a resource object returned by the API into a concrete
   * `CampaignGoal` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the resource did
   *     not contain the expected properties
   */
  map(resource) {
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties: ['campaignGoalType', 'performanceGoal'],
      }) &&
      PerformanceGoalMapper.map(resource.performanceGoal)
    ) {
      return resource;
    }
    return undefined;
  },
};

/**
 * Defines an insertion order's budget segment configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers.insertionOrders#InsertionOrderBudgetSegment
 *
 */
export interface InsertionOrderBudgetSegment {
  budgetAmountMicros: string;
  dateRange: { startDate: RawApiDate; endDate: RawApiDate };
}

/**
 * Exports a mapper from an API resource to `InsertionOrderBudgetSegment`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const InsertionOrderBudgetSegmentMapper: MapperWithJsonOut<InsertionOrderBudgetSegment> =
  {
    /**
     * Converts a resource object returned by the API into a concrete
     * `InsertionOrderBudgetSegment` instance.
     *
     * @param resource The API resource object
     * @return The concrete instance, or null if
     *     the resource did not contain the expected properties
     */
    map(resource) {
      if (!resource.hasOwnProperty('budgetAmountMicros')) {
        resource.budgetAmountMicros = '0';
      }
      if (
        ObjectUtil.hasOwnProperties(resource, {
          requiredProperties: ['budgetAmountMicros', 'dateRange'],
        })
      ) {
        const dateRange = resource.dateRange;
        const startDateValid = ApiDate.validate(dateRange['startDate']);
        const endDateValid = ApiDate.validate(dateRange['endDate']);

        if (startDateValid && endDateValid) {
          return resource;
        }
      }
      return undefined;
    },

    /**
     * Converts an `InsertionOrderBudgetSegment` to its expected JSON
     * representation.
     *
     * @param segment The segment to convert
     * @return The custom JSON representation of the
     *     `InsertionOrderBudgetSegment`
     */
    toJson(segment) {
      return {
        budgetAmountMicros: segment.budgetAmountMicros,
        dateRange: {
          startDate: segment.dateRange.startDate,
          endDate: segment.dateRange.endDate,
        },
      };
    },
  };

/**
 * Defines an insertion order's budget configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers.insertionOrders#InsertionOrderBudget
 *
 */
export interface InsertionOrderBudget {
  budgetUnit?: string;
  budgetSegments?: InsertionOrderBudgetSegment[];
}

/**
 * Exports a mapper from an API resource to `InsertionOrderBudget`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const InsertionOrderBudgetMapper: MapperWithJsonOut<InsertionOrderBudget> =
  {
    /**
     * Converts a resource object returned by the API into a concrete
     * `InsertionOrderBudget` instance.
     *
     * @param resource The API resource object
     * @return The concrete instance, or null if the
     *     resource did not contain the expected properties
     */
    map(resource) {
      if (
        ObjectUtil.hasOwnProperties(resource, {
          requiredProperties: ['budgetUnit', 'budgetSegments'],
        })
      ) {
        const budgetSegments = resource.budgetSegments;

        if (Array.isArray(budgetSegments) && budgetSegments.length !== 0) {
          let valid = true;

          budgetSegments.forEach((segment) => {
            const mappedSegment =
              InsertionOrderBudgetSegmentMapper.map(segment);
            valid = valid && Boolean(mappedSegment);
          });

          if (valid) {
            return resource;
          }
        }
      }
      return {};
    },

    /**
     * Converts an `InsertionOrderBudget` to its expected JSON representation.
     *
     * @param budget The budget to convert
     * @return The custom JSON representation of the
     *     `InsertionOrderBudget`
     */
    toJson(budget) {
      const segments = budget.budgetSegments.map((segment) =>
        InsertionOrderBudgetSegmentMapper.toJson(segment),
      );

      return { budgetUnit: budget.budgetUnit, budgetSegments: segments };
    },
  };

/**
 * Defines line item flight configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers.lineItems#LineItemFlight
 *
 */
export interface LineItemFlight {
  flightDateType: LineItemFlightDateType;
  dateRange?: { startDate: RawApiDate; endDate: RawApiDate };
}

/**
 * Exports a mapper from an API resource to `LineItemFlight`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const LineItemFlightMapper: MapperWithJsonOut<LineItemFlight> = {
  /**
   * Converts a resource object returned by the API into a concrete
   * `LineItemFlight` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the resource
   *     did not contain the expected properties
   */
  map(resource) {
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties: ['flightDateType'],
      })
    ) {
      const dateRange = resource.dateRange;
      let validDateRange = false;

      if (dateRange) {
        const endDate1 = dateRange.endDate;
        const startDateValid = ApiDate.validate(dateRange['startDate']);
        const endDateValid = ApiDate.validate(endDate1);

        if (startDateValid && endDateValid) {
          validDateRange = true;
        }
      }
      if (!dateRange || validDateRange) {
        return resource;
      }
    }
    return undefined;
  },

  /**
   * Converts a `LineItemFlight` to its expected JSON representation.
   *
   * @param flight The flight to convert
   * @return The custom JSON representation of the
   *     `LineItemFlight`
   */
  toJson(flight: LineItemFlight) {
    if (!flight.dateRange) {
      return flight;
    }
    return {
      ...{
        flightDateType: flight.flightDateType,
        dateRange: {
          startDate: flight.dateRange.startDate,
          endDate: flight.dateRange.endDate,
        },
      },
    };
  },
};

/**
 * Defines line item budget configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers.lineItems#LineItemBudget
 *
 */
export interface LineItemBudget {
  budgetAllocationType?: BudgetAllocationType;
  budgetUnit?: BudgetUnit;
  maxAmount?: string;
}

/**
 * Exports a mapper from an API resource to `LineItemBudget`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const LineItemBudgetMapper: Mapper<LineItemBudget> = {
  /**
   * Converts a resource object returned by the API into a concrete
   * `LineItemBudget` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the resource
   *     did not contain the expected properties
   */
  map(resource) {
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties: ['budgetAllocationType'],
      })
    ) {
      return resource as unknown as LineItemBudget;
    }
    return {};
  },
};

/**
 * Defines line item partner revenue model configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/advertisers.lineItems#PartnerRevenueModel
 *
 */
export interface LineItemPartnerRevenueModel {
  markupType: string;
  markupAmount?: string;
}

/**
 * Exports a mapper from an API resource to `LineItemPartnerRevenueModel`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const LineItemPartnerRevenueModelMapper: Mapper<LineItemPartnerRevenueModel> =
  {
    /**
     * Converts a resource object returned by the API into a concrete
     * `LineItemPartnerRevenueModel` instance.
     *
     * @param resource The API resource object
     * @return The concrete instance, or null if
     *     the resource did not contain the expected properties
     */
    map(resource) {
      if (
        ObjectUtil.hasOwnProperties(resource, {
          requiredProperties: ['markupType'],
        })
      ) {
        return resource;
      }
      return undefined;
    },
  };

/**
 * Defines configuration for an amount of money with its currency type.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/inventorySources#Money
 *
 */
export interface InventorySourceMoney {
  currencyCode: string;
  units?: string;
  nanos?: string;
}

/**
 * Exports a mapper from an API resource to `InventorySourceMoney`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const InventorySourceMoneyMapper: Mapper<InventorySourceMoney> = {
  /**
   * Converts a resource object returned by the API into a concrete
   * `InventorySourceMoney` instance.
   *
   * @param resource The API resource object
   * @return The concrete instance, or null if the
   *     resource did not contain the expected properties
   */
  map(resource) {
    if (
      ObjectUtil.hasOwnProperties(resource, {
        requiredProperties: ['currencyCode'],
        oneOf: ['units', 'nanos'],
      })
    ) {
      return resource;
    }
    return undefined;
  },
};

/**
 * Defines inventory source rate details configuration.
 * @see https://developers.google.com/display-video/api/reference/rest/v3/inventorySources#RateDetails
 *
 */
export interface InventorySourceRateDetails {
  inventorySourceRateType?: string;
  rate: InventorySourceMoney;
  unitsPurchased?: string;
  minimumSpend?: InventorySourceMoney;
}

/**
 * Exports a mapper from an API resource to `InventorySourceRateDetails`
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const InventorySourceRateDetailsMapper: Mapper<InventorySourceRateDetails> =
  {
    /**
     * Converts a resource object returned by the API into a concrete
     * `InventorySourceRateDetails` instance.
     *
     * @param resource The API resource object
     * @return The concrete instance, or null if
     *     the resource did not contain the expected properties
     */
    map(resource) {
      if (
        ObjectUtil.hasOwnProperties(resource, { requiredProperties: ['rate'] })
      ) {
        const minimumSpend = resource.minimumSpend;
        const valid =
          InventorySourceMoneyMapper.map(resource.rate) &&
          (!minimumSpend || InventorySourceMoneyMapper.map(minimumSpend));

        if (valid) {
          return resource as unknown as InventorySourceRateDetails;
        }
      }
      return undefined;
    },
  };

/**
 * A simplified interface for {@link ApiDate} which has better interop.
 */
export interface RawApiDate {
  year: Readonly<number>;
  month: Readonly<number>;
  day: Readonly<number>;
}

/**
 * Class representing a date as it is provided by the DV360 API. Note:
 * individual values are not padded (i.e. 1 is valid for day or month) and may
 * be 0 to indicate 'ignore value' (e.g. 0 for day means a year and month
 * representation without a specific day).
 *
 */
export class ApiDate implements RawApiDate {
  /**
   * Constructs an instance of `ApiDate`.
   */
  constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
  ) {}

  /**
   * Converts a resource object returned by the API to `ApiDate` if it matches
   * the type. Returns null for any invalid input.
   *
   * @param rawDate The raw object to convert. Can be null or undefined
   * @return The concrete `ApiDate`, or null if invalid
   */
  static fromApiResource(rawDate: RawApiDate): ApiDate | null {
    if (ApiDate.validate(rawDate)) {
      return new ApiDate(
        Number(rawDate.year),
        Number(rawDate.month),
        Number(rawDate.day),
      );
    }
    return null;
  }

  /**
   * Returns a new `ApiDate` for the current date.
   *
   */
  static now(): ApiDate {
    const date = new Date();

    return new ApiDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  /**
   * Returns all properties of this `ApiDate` that are modifiable.
   *
   * @param prefix Optional prefix for the properties. Defaults to an
   *     empty string
   * @return An array of properties that are modifiable
   */
  static getMutableProperties(prefix: string = ''): string[] {
    return [`${prefix}year`, `${prefix}month`, `${prefix}day`];
  }

  /**
   * Compares this `ApiDate` to 'other' and returns an `Array` of changed
   * properties.
   *
   * @param other The other api date to compare
   * @param prefix Optional prefix for the changed properties.
   *     Defaults to an empty string
   * @return An array of changed mutable properties between
   *     this and 'other'
   */
  getChangedProperties(
    other: RawApiDate | null,
    prefix: string = '',
  ): string[] {
    const changedProperties = [];

    if (other) {
      if (this.getYear() !== other.year) {
        changedProperties.push(`${prefix}year`);
      }
      if (this.getMonth() !== other.month) {
        changedProperties.push(`${prefix}month`);
      }
      if (this.getDay() !== other.day) {
        changedProperties.push(`${prefix}day`);
      }
    } else {
      return ApiDate.getMutableProperties(prefix);
    }
    return changedProperties;
  }

  /**
   * Converts this instance of `ApiDate` to its expected JSON representation.
   * This method is called by default when an instance of `ApiDate` is passed
   * to `JSON.stringify`.
   *
   * @return The custom JSON representation of this
   *     `ApiDate` instance
   */
  toJSON(): RawApiDate {
    return { year: this.getYear(), month: this.getMonth(), day: this.getDay() };
  }

  toDate(): Date {
    return new Date(this.getYear(), this.getMonth(), this.getDay());
  }

  /**
   * Returns the year.
   *
   */
  getYear(): number {
    return this.year;
  }

  /**
   * Returns the month.
   *
   */
  getMonth(): number {
    return this.month;
  }

  /**
   * Returns the day.
   *
   */
  getDay(): number {
    return this.day;
  }

  static validate(rawDate: RawApiDate) {
    return (
      ObjectUtil.hasOwnProperties(rawDate, {
        requiredProperties: ['year', 'month', 'day'],
      }) &&
      Number.isInteger(rawDate.year) &&
      Number.isInteger(rawDate.month) &&
      Number.isInteger(rawDate.day)
    );
  }
}

/**
 * Possible budget allocation type options.
 */
export type BudgetAllocationType =
  | 'LINE_ITEM_BUDGET_ALLOCATION_TYPE_UNSPECIFIED'
  | 'LINE_ITEM_BUDGET_ALLOCATION_TYPE_AUTOMATIC'
  | 'LINE_ITEM_BUDGET_ALLOCATION_TYPE_FIXED'
  | 'LINE_ITEM_BUDGET_ALLOCATION_TYPE_UNLMITED';

/**
 * Possible budget unit options.
 */
export type BudgetUnit =
  | 'BUDGET_UNIT_UNSPECIFIED'
  | 'BUDGET_UNIT_CURRENCY'
  | 'BUDGET_UNIT_IMPRESSIONS';

type EnumLikeTypeCheck<T> = T[keyof T];
