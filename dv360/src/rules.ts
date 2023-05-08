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

/**
 * @fileoverview Contains rules tailored for the current client.
 */

import {AssignedTargetingOption, InsertionOrder} from 'google3/third_party/gps_building_blocks/ts/dv360_api_lib/src/dv360_resources';
import {InsertionOrderBudgetSegment, TARGETING_TYPE} from 'google3/third_party/gps_building_blocks/ts/dv360_api_lib/src/dv360_types';
import {equalTo, inRange, lessThanOrEqualTo} from 'anomaly_library/absoluteRule';
import {Rule, Values} from 'anomaly_library/main';

import {Settings} from '../../common/types';

import {getDate, newRule} from './client';
import {ClientInterface, RuleGranularity} from './types';
import {DailyBudget} from './rule_types';

const DAY_DENOMINATOR = 1000 * 24 * 60 * 60;

const IS_NUMBER = `=ISNUMBER(INDIRECT(ADDRESS(ROW(), COLUMN())))`;

const RULES = {
  LESS_THAN_MAX: [
    `=LT(
    INDIRECT(ADDRESS(ROW(), COLUMN())), INDIRECT(ADDRESS(ROW(), COLUMN() + 1))
  )`,
    IS_NUMBER
  ],
  GREATER_THAN_MIN: [
    `=GT(
    INDIRECT(ADDRESS(ROW(), COLUMN())), INDIRECT(ADDRESS(ROW(), COLUMN() - 1))
  )`,
    IS_NUMBER
  ],
};

/**
 * Adds a geotarget rule.
 *
 * Must have only US targets, and must contain at least one geo-target, to pass.
 */
export const geoTargetRule = newRule({
  name: 'Geo Targeting',
  valueFormat: {
    label: 'Geo Targets Set?',
  },
  helper: `=HYPERLINK(
    "https://developers.google.com/google-ads/api/reference/data/geotargets", "Separate values with commas. Partial match any canonical name linked.")`,
  params: {
    geotargeting: {
      label: 'Geo Targets',
      validationFormulas: [
        '=REGEXMATCH(INDIRECT(ADDRESS(ROW(), COLUMN())), "^[a-zA-Z ]+(,\\s*[a-zA-Z ]+)?$")'
      ],
    },
    excludes: {
      label: 'Excluded Geo Targets',
      validationFormulas: [
        '=REGEXMATCH(INDIRECT(ADDRESS(ROW(), COLUMN())), "^[a-zA-Z ]+(,\\s*[a-zA-Z ]+)?$")'
      ],
    }
  },
  granularity: RuleGranularity.CAMPAIGN,
  uniqueKeyPrefix: 'geo',
  defaults: {
    geotargeting: 'United States',
    excludes: '',
  },
  async callback() {
    const uniqueKey = this.getUniqueKey();
    const rule = equalTo({uniqueKey, thresholdValue: 1});
    const values: Values = {};

    for (const {advertiserId, id, displayName} of await this.client
             .getAllCampaigns()) {
      const targetingOptionApi = new this.client.settings.assignedTargetingOptions!(
          TARGETING_TYPE.GEO_REGION, advertiserId, {campaignId: id});
      let hasOnlyValidGeo = true;
      const campaignSettings = this.settings.getOrDefault(id);

      let targetingOptionsLength = 0;

      targetingOptionApi.list((targetingOptions: AssignedTargetingOption[]) => {
        function hasAllowedGeo(targetingOption: AssignedTargetingOption) {
          const displayName = targetingOption.getDisplayName();
          if (!displayName) {
            throw new Error('Missing display name');
          }
          const geoTargets = campaignSettings.geotargeting.split(',').map((country: string) => country.trim());
          const excludes = campaignSettings.excludes.split(',').map((country: string) => country.trim());

          if (targetingOption.getTargetingDetails()['negative']) {
            return !excludes.some(
                (geoTarget: string) => displayName.indexOf(geoTarget) >= 0);
          }
          return geoTargets.some(
              (geoTarget: string) => displayName.indexOf(geoTarget) >= 0);
        }

        // Don't accidentally overwrite hasOnlyValidGeo if it's been set to
        // false.
        if (hasOnlyValidGeo) {
          hasOnlyValidGeo = Boolean(
              targetingOptions.length && targetingOptions.every(hasAllowedGeo));
        }
        targetingOptionsLength += targetingOptions.length;
      });
      values[id] = (rule.createValue(hasOnlyValidGeo ? '1' : '0', {
        'Campaign Name': displayName,
        'Campaign ID': id,
        'Number of Geos': String(targetingOptionsLength),
      }));
    }

    return {rule, values};
  }
});

/**
 * Sets a violation if budget is pacing `X`% ahead of schedule.
 *
 * Compares DBM spend against DV360 budgets over a flight duration.
 */
export const budgetPacingPercentageRule = newRule({
  name: 'Budget Pacing by Percent Ahead',
  valueFormat: {
    label: '% Ahead of Budget',
    numberFormat: '0.00%',
  },
  granularity: RuleGranularity.INSERTION_ORDER,
  params: {
    min: {label: 'Min. Percent Ahead/Behind', validationFormulas: RULES.LESS_THAN_MAX},
    max: {
      label: 'Max. Percent Ahead/Behind',
      validationFormulas: RULES.GREATER_THAN_MIN
    },
  },
  defaults: {min: '0', max: '0.5'},
  uniqueKeyPrefix: 'pacingPercent',
  async callback() {
    const uniqueKey: string = this.getUniqueKey();
    const rules: {[campaignId: string]: Rule} = {};
    const rule = this.getRule();
    const values: Values = {};

    let earliestStartDate: Date|undefined = undefined;
    let latestEndDate: Date|undefined = undefined;

    const results: Array<{
      budget: number,
      campaignId: string,
      displayName: string,
      insertionOrderId: string,
      startDate: Date,
      endDate: Date
    }> = [];
    const today = Date.now();
    const todayDate = new Date(today);
    for (const insertionOrder of this.client.getAllInsertionOrders()) {
      const {insertionOrderId, displayName} =
          getPacingVariables(insertionOrder, this.settings, rules, uniqueKey);
      for (const budgetSegment of
          insertionOrder.getInsertionOrderBudgetSegments()) {
        const startDate = getDate(budgetSegment.dateRange.startDate);
        const endDate = getDate(budgetSegment.dateRange.endDate);
        if (!(startDate < todayDate && todayDate < endDate)) {
          continue;
        }
        if (insertionOrder.getInsertionOrderBudget().budgetUnit !==
            'BUDGET_UNIT_CURRENCY') {
          continue;
        }
        earliestStartDate = earliestStartDate && earliestStartDate < startDate ?
            earliestStartDate :
            startDate;
        latestEndDate =
            latestEndDate && latestEndDate < endDate ? latestEndDate : endDate;
        results.push({
          campaignId: insertionOrder.getCampaignId(),
          displayName,
          insertionOrderId,
          startDate,
          endDate,
          budget: Number(budgetSegment.budgetAmountMicros) / 1_000_000,
        });
      }
    }
    if (!earliestStartDate || !latestEndDate) {
      return {rule, values};
    }
    const budgetReport = this.client.getBudgetReport({
      startDate: earliestStartDate,
      endDate: latestEndDate,
    });
    for (const {
      budget,
      campaignId,
      displayName,
      insertionOrderId,
      startDate,
      endDate
    } of results) {
      const startTimeSeconds = startDate.getTime();
      const endTimeSeconds = endDate.getTime();
      const flightDuration = endTimeSeconds - startTimeSeconds;
      const timeElapsed = today - startTimeSeconds;
      const spend = budgetReport.getSpendForInsertionOrder(
          insertionOrderId, startTimeSeconds, endTimeSeconds);
      if (spend === undefined) {
        continue;
      }
      const budgetToFlightDuration = budget / (flightDuration / DAY_DENOMINATOR);
      const spendToTimeElapsed = spend / (timeElapsed / DAY_DENOMINATOR);
      const percent = spendToTimeElapsed / budgetToFlightDuration - 1;
      values[insertionOrderId] = (rules[insertionOrderId].createValue(percent.toString(), {
        'Insertion Order ID': insertionOrderId,
        'Display Name': displayName,
        'Campaign ID': campaignId,
        'Flight Start': startDate.toDateString(),
        'Flight End': endDate.toDateString(),
        'Spend': `$${spend.toString()}`,
        'Budget': `$${budget.toString()}`,
        'Pacing': `${(spendToTimeElapsed / budgetToFlightDuration) * 100}%`,
        'Days Elapsed': (timeElapsed / DAY_DENOMINATOR).toString(),
        'Flight Duration': (flightDuration / DAY_DENOMINATOR).toString(),
      }));
    }
    return {rule, values};
  }
});

function getPacingVariables<P extends Record<'min'|'max', string>>(
    insertionOrder: InsertionOrder, settings: Settings<P>,
    rules: {[p: string]: Rule}, uniqueKey: string) {
  const insertionOrderId = insertionOrder.getId()!;
  const campaignSettings = settings.getOrDefault(insertionOrderId);
  if (!rules[insertionOrderId]) {
    rules[insertionOrderId] = inRange({
      uniqueKey,
      thresholdValue: {
        min: Number(campaignSettings.min),
        max: Number(campaignSettings.max),
      },
    });
  }
  const displayName = insertionOrder.getDisplayName();
  if (!displayName) {
    throw new Error('Missing ID or Display Name for Insertion Order.');
  }
  return {insertionOrderId, displayName};
}

/**
 * Sets a violation if budget is pacing `days` ahead of schedule.
 *
 * Compares DBM spend against DV360 budgets over a flight duration.
 */
export const budgetPacingDaysAheadRule = newRule({
  name: 'Budget Pacing by Days Ahead/Behind',
  valueFormat: {
    label: 'Days Ahead/Behind',
    numberFormat: '0.0',
  },
  params: {
    min: {
      label: 'Min. Days Ahead/Behind (+/-)',
      validationFormulas: RULES.LESS_THAN_MAX,
    },
    max: {
      label: 'Max. Days Ahead/Behind (+/-)',
      validationFormulas: RULES.GREATER_THAN_MIN,
    },
  },
  defaults: {
    min: '-1',
    max: '1',
  },
  granularity: RuleGranularity.INSERTION_ORDER,
  uniqueKeyPrefix: 'pacingDays',
  async callback() {
    const uniqueKey: string = this.getUniqueKey();
    const rules: {[campaignId: string]: Rule} = {};
    const rule = this.getRule();
    const values: Values = {};
    const result: Array<{
      campaignId: string,
      displayName: string,
      insertionOrderId: string,
      budget: number,
      startDate: Date,
      endDate: Date
    }> = [];
    let earliestStartDate: Date|undefined = undefined;
    let latestEndDate: Date|undefined = undefined;
    const today = Date.now();
    const todayDate = new Date(today);
    for (const insertionOrder of this.client.getAllInsertionOrders()) {
      if (insertionOrder.getInsertionOrderBudget().budgetUnit !== 'BUDGET_UNIT_CURRENCY') {
        continue;
      }
      const {insertionOrderId, displayName} =
          getPacingVariables(insertionOrder, this.settings, rules, uniqueKey);
      for (const budgetSegment of
          insertionOrder.getInsertionOrderBudgetSegments()) {
        const startDate = getDate(budgetSegment.dateRange.startDate);
        const endDate = getDate(budgetSegment.dateRange.endDate);
        if (!(startDate < todayDate && todayDate < endDate)) {
          continue;
        }

        // @ts-ignore(go/ts50upgrade): Operator '<' cannot be applied to types 'never' and 'Date'.
        earliestStartDate = earliestStartDate && earliestStartDate < startDate ?
            earliestStartDate :
            startDate;
        latestEndDate =
            // @ts-ignore(go/ts50upgrade): Operator '>' cannot be applied to types 'never' and 'Date'.
            latestEndDate && latestEndDate > endDate ? latestEndDate : endDate;
        result.push({
          campaignId: insertionOrder.getCampaignId(),
          displayName,
          insertionOrderId,
          budget: Number(budgetSegment.budgetAmountMicros) / 1_000_000,
          startDate,
          endDate,
        });
      }
    }
    if (!earliestStartDate || !latestEndDate) {
      return {rule, values};
    }
    const budgetReport = this.client.getBudgetReport({
      startDate: earliestStartDate,
      endDate: latestEndDate,
    });
    for (const {
      campaignId,
      displayName,
      insertionOrderId,
      budget,
      startDate,
      endDate
    } of result) {
      const startTimeSeconds = startDate.getTime();
      const endTimeSeconds = endDate.getTime();
      const spend = budgetReport.getSpendForInsertionOrder(
          insertionOrderId, startTimeSeconds, endTimeSeconds);
      if (spend === undefined) {
        continue;
      }
      const daysToCampaignEnd =
          (endTimeSeconds - startTimeSeconds) / DAY_DENOMINATOR;
      const daysToToday = (today - startTimeSeconds) / DAY_DENOMINATOR;
      const budgetPerDay = budget / daysToCampaignEnd;
      const actualSpendPerDay = spend / daysToToday;
      const days = (actualSpendPerDay / budgetPerDay) * daysToToday - daysToToday;
      values[insertionOrderId] = (rules[insertionOrderId].createValue(days.toString(), {
        'Insertion Order ID': insertionOrderId,
        'Display Name': displayName,
        'Campaign ID': campaignId,
        'Flight Start': startDate.toDateString(),
        'Flight End': endDate.toDateString(),
        'Spend': spend.toString(),
        'Budget': budget.toString(),
      }));
    }
    return {rule, values};
  },
});

/**
 *  Checks if daily spend is outside the specified range `min` and `max`.
 */
export const dailyBudgetRule = newRule({
  name: 'Budget Per Day',
  valueFormat: {
    label: 'Daily Budget',
    numberFormat: '0.00',
  },
  params: {
    min: {
      label: 'Min. Daily Budget',
      validationFormulas: RULES.LESS_THAN_MAX,
    },
    max: {
      label: 'Max. Daily Budget',
      validationFormulas: RULES.GREATER_THAN_MIN,
    },
  },
  defaults: {
    min: '0',
    max: '1000000',
  },
  granularity: RuleGranularity.INSERTION_ORDER,
  uniqueKeyPrefix: 'dailyBudget',
  async callback() {
    const uniqueKey = this.getUniqueKey();
    const rule = this.getRule();
    const values: Values = {};
    const rules: {[campaignId: string]: Rule} = {};

    for (const insertionOrder of this.client.getAllInsertionOrders()) {
      const insertionOrderId = insertionOrder.getId()!;
      const campaignSettings = this.settings.getOrDefault(insertionOrderId);
      if (!rules[insertionOrderId]) {
        rules[insertionOrderId] = inRange({
          uniqueKey,
          thresholdValue: {
            min: Number(campaignSettings.min),
            max: Number(campaignSettings.max),
          }
        });
      }
      const displayName = insertionOrder.getDisplayName();
      if (!displayName) {
        throw new Error('Missing ID or Display Name for Insertion Order.');
      }
      for (const dailyBudgets of checkPlannedDailyBudget(
          this.client, insertionOrder)) {
        values[insertionOrderId] = (rules[insertionOrderId].createValue(dailyBudgets.dailyBudget.toString(), {
          'Insertion Order ID': insertionOrderId,
          'Display Name': displayName,
          'Budget': dailyBudgets.budget.toString(),
          'Flight Duration': dailyBudgets.flightDurationDays.toString(),
        }));
      }
    }
    return {rule, values};
  }
});

/**
 * Checks the daily spend against a budget.
 */
function checkPlannedDailyBudget(
    client: ClientInterface, insertionOrder: InsertionOrder): DailyBudget[] {
  const dailyBudgets: DailyBudget[] = [];
  for (const budgetSegment of
           insertionOrder.getInsertionOrderBudgetSegments()) {
    if (insertionOrder.getInsertionOrderBudget().budgetUnit !== 'BUDGET_UNIT_CURRENCY') {
      continue;
    }
    const today = Date.now();
    const startDate = getDate(budgetSegment.dateRange.startDate);
    const endDate = getDate(budgetSegment.dateRange.endDate);
    const endTimeSeconds = endDate.getTime();

    if (today > endTimeSeconds) {
      continue;
    }

    const budget = Number(budgetSegment.budgetAmountMicros) / 1_000_000;
    const flightDurationDays =
        (endDate.getTime() - startDate.getTime()) / DAY_DENOMINATOR;

    dailyBudgets.push({
      dailyBudget: budget / flightDurationDays,
      flightDurationDays,
      budget,
    });
  }
  return dailyBudgets;
}

function calculateOuterBounds(
    range: {startDate: Date|undefined, endDate: Date|undefined},
    budgetSegment: InsertionOrderBudgetSegment, todayDate: Date) {
  const startDate = getDate(budgetSegment.dateRange.startDate);
  const endDate = getDate(budgetSegment.dateRange.endDate);
  if (!(startDate < todayDate && todayDate < endDate)) {
    return;
  }
  range.startDate = range.startDate && range.startDate < startDate ?
      range.startDate :
      startDate;
  range.endDate =
      range.endDate && range.endDate < endDate ? range.endDate : endDate;
}

/**
 * Sets a violation if budget is pacing `X`% ahead of schedule.
 *
 * Compares DBM spend against DV360 budgets over a flight duration.
 */
export const impressionsByGeoTarget = newRule({
  name: 'Impressions by Geo Target',
  valueFormat: {
    label: '% Invalid Impressions',
    numberFormat: '0%',
  },
  params: {
    countries: {label: 'Allowed Countries (Comma Separated)'},
    maxOutside: {
      label: 'Max. Percent Outside Geos',
      validationFormulas: RULES.GREATER_THAN_MIN
    },
  },
  granularity: RuleGranularity.INSERTION_ORDER,
  helper: `=HYPERLINK(
    "https://developers.google.com/google-ads/api/reference/data/geotargets", "Use the 2-digit country codes found in this report.")`,
  defaults: {countries: 'US', maxOutside: '0.01'},
  uniqueKeyPrefix: 'impressionsByGeo',
  async callback() {
    const rule = this.getRule();
    const values: Values = {};

    const range = {
      startDate: undefined,
      endDate: undefined,
    } as {startDate: Date | undefined, endDate: Date | undefined};

    const today = Date.now();
    const todayDate = new Date(today);
    const result: {
      [insertionOrderId: string]: {campaignId: string, displayName: string}
    } = {};

    for (const insertionOrder of this.client.getAllInsertionOrders()) {
      for (const budgetSegment of
               insertionOrder.getInsertionOrderBudgetSegments()) {
        calculateOuterBounds(range, budgetSegment, todayDate);
      }
      result[insertionOrder.getId()!] = {
        campaignId: insertionOrder.getCampaignId(),
        displayName: insertionOrder.getDisplayName() ?? '',
      };
    }

    if (!range.startDate || !range.endDate) {
      return {rule, values};
    }
    const impressionReport = new this.client.settings.impressionReport!({
      idType: this.client.settings.idType,
      id: this.client.settings.id,
      ...(range as {startDate: Date, endDate: Date}),
    });

    for (const [insertionOrderId, {campaignId, displayName}] of Object
        .entries(result)) {
      const campaignSettings = this.settings.getOrDefault(insertionOrderId);
      const impressions = impressionReport.getImpressionPercentOutsideOfGeos(insertionOrderId, campaignSettings.countries.split(',').map((country: string) => country.trim()));
      const rule = lessThanOrEqualTo({thresholdValue: Number(campaignSettings.maxOutside), uniqueKey: this.getUniqueKey()});
      values[insertionOrderId] = (rule.createValue(impressions.toString(), {
        'Insertion Order ID': insertionOrderId,
        'Display Name': displayName,
        'Campaign ID': campaignId,
      }));
    }
    return {rule, values};
  }
});
