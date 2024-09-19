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
 * @fileoverview Contains rules tailored for the current client.
 */

import {
  AssignedTargetingOption,
  InsertionOrder,
} from 'dv360_api/dv360_resources';
import {
  InsertionOrderBudgetSegment,
  PACING_TYPE,
  PacingType,
  TARGETING_TYPE,
} from 'dv360_api/dv360_types';
import { equalTo, inRange, lessThanOrEqualTo } from 'common/checks';
import { Settings, Value, Values } from 'common/types';

import { getDate, newRule } from './client';
import { ClientInterface, RuleGranularity } from './types';
import { DailyBudget } from './rule_types';

const DAY_DENOMINATOR = 1000 * 24 * 60 * 60;

const IS_NUMBER = `=ISNUMBER(INDIRECT(ADDRESS(ROW(), COLUMN())))`;

const RULES = {
  LESS_THAN_MAX: [
    `=LT(
    INDIRECT(ADDRESS(ROW(), COLUMN())), INDIRECT(ADDRESS(ROW(), COLUMN() + 1))
  )`,
    IS_NUMBER,
  ],
  GREATER_THAN_MIN: [
    `=GT(
    INDIRECT(ADDRESS(ROW(), COLUMN())), INDIRECT(ADDRESS(ROW(), COLUMN() - 1))
  )`,
    IS_NUMBER,
  ],
};

/**
 * Provides a mechanism to preload checks with tests.
 */
type AbridgedCheck = (
  value: string,
  fields: { [key: string]: string },
) => Value;

/**
 * Adds a geotarget rule.
 *
 * Must have only US targets, and must contain at least one geo-target, to pass.
 */
export const geoTargetRule = newRule({
  name: 'Geo Targeting',
  description: `Checks to see if a comma separated list of geo targets is set on
    a campaign. If in the "Geo Targets" list, an anomaly will be registered if
    the geo target is not set in the campaign target settings. Likewise, if the
    geo is in the "Excluded Geo Targets" list, an anomaly will be registered
    if the geo target is not explicitly excluded. Included and excluded targets
    must be partial matches of canonical names in
    <a href="https://developers.google.com/google-ads/api/reference/data/geotargets">this list.</a>`,
  valueFormat: {
    label: 'Geo Targets Set?',
  },
  helper: `=HYPERLINK(
    "https://developers.google.com/google-ads/api/reference/data/geotargets", "Separate values with commas. Partial match any canonical name linked.")`,
  params: {
    geotargeting: {
      label: 'Geo Targets',
      validationFormulas: [
        '=REGEXMATCH(INDIRECT(ADDRESS(ROW(), COLUMN())), "^[a-zA-Z ]+(,\\s*[a-zA-Z ]+)?$")',
      ],
      defaultValue: 'United States',
    },
    excludes: {
      label: 'Excluded Geo Targets',
      validationFormulas: [
        '=REGEXMATCH(INDIRECT(ADDRESS(ROW(), COLUMN())), "^[a-zA-Z ]+(,\\s*[a-zA-Z ]+)?$")',
      ],
      defaultValue: '',
    },
  },
  granularity: RuleGranularity.CAMPAIGN,
  async callback() {
    const values: Values = {};

    for (const {
      advertiserId,
      id,
      displayName,
    } of await this.client.getAllCampaigns()) {
      const targetingOptionApi =
        new this.client.dao.accessors.assignedTargetingOptions!(
          TARGETING_TYPE.GEO_REGION,
          advertiserId,
          { campaignId: id },
        );
      let hasOnlyValidGeo = true;
      const campaignSettings = this.settings.getOrDefault(id);

      let targetingOptionsLength = 0;

      targetingOptionApi.list((targetingOptions: AssignedTargetingOption[]) => {
        function hasAllowedGeo(targetingOption: AssignedTargetingOption) {
          const displayName = targetingOption.getDisplayName();
          if (!displayName) {
            throw new Error('Missing display name');
          }
          const geoTargets = campaignSettings.geotargeting
            .split(',')
            .map((country: string) => country.trim());
          const excludes = campaignSettings.excludes
            .split(',')
            .map((country: string) => country.trim());

          if (targetingOption.getTargetingDetails()['negative']) {
            return !excludes.some(
              (geoTarget: string) => displayName.indexOf(geoTarget) >= 0,
            );
          }
          return geoTargets.some(
            (geoTarget: string) => displayName.indexOf(geoTarget) >= 0,
          );
        }

        // Don't accidentally overwrite hasOnlyValidGeo if it's been set to
        // false.
        if (hasOnlyValidGeo) {
          hasOnlyValidGeo = Boolean(
            targetingOptions.length && targetingOptions.every(hasAllowedGeo),
          );
        }
        targetingOptionsLength += targetingOptions.length;
      });
      values[id] = equalTo(1, hasOnlyValidGeo ? 1 : 0, {
        'Advertiser ID': advertiserId,
        'Campaign Name': displayName,
        'Campaign ID': id,
        'Number of Geos': String(targetingOptionsLength),
      });
    }

    return { values };
  },
});

/**
 * Sets a violation if budget is pacing `X`% ahead of schedule.
 *
 * Compares DBM spend against DV360 budgets over a flight duration.
 */
export const budgetPacingPercentageRule = newRule({
  name: 'Budget Pacing by Percent Ahead',
  description: `For an IO, checks to see if each running budget segment is
    pacing above or behind using the following equation:
    (Current Spend / Time Elapsed from Flight Start) / (Budget Spend / Total Planned Flight Time) - 1.
    If spend is pacing behind at 85% of plan, then the total will be -0.15. If
    the spend is pacing at 115% of plan, then the total will be 1.15.`,
  valueFormat: {
    label: '% Ahead of Budget',
    numberFormat: '0.00%',
  },
  granularity: RuleGranularity.INSERTION_ORDER,
  params: {
    min: {
      label: 'Min. Percent Ahead/Behind',
      validationFormulas: RULES.LESS_THAN_MAX,
      defaultValue: '0',
    },
    max: {
      label: 'Max. Percent Ahead/Behind',
      validationFormulas: RULES.GREATER_THAN_MIN,
      defaultValue: '0.5',
    },
    pacingType: {
      label: 'Pacing Type',
      defaultValue: PACING_TYPE.AHEAD,
    },
  },
  async callback() {
    const rules: { [campaignId: string]: AbridgedCheck } = {};
    const values: Values = {};

    const dateRange: { earliestStartDate?: Date; latestEndDate?: Date } = {};
    type SettingsObj =
      typeof this.settings extends Settings<infer I> ? I : never;
    const results: Array<{
      budget: number;
      campaignId: string;
      displayName: string;
      insertionOrderId: string;
      startDate: Date;
      endDate: Date;
      settings: SettingsObj;
      pacingType: PacingType;
    }> = [];
    const today = Date.now();
    const todayDate = new Date(today);
    for (const insertionOrder of Object.values(
      this.client.getAllInsertionOrders(),
    )) {
      const pacingType = insertionOrder.getInsertionOrderPacing().pacingType;
      const insertionOrderId = insertionOrder.getId()!;
      const displayName = insertionOrder.getDisplayName();
      const settings = this.settings.getOrDefault(insertionOrderId);
      for (const budgetSegment of insertionOrder.getInsertionOrderBudgetSegments()) {
        const startDate = getDate(budgetSegment.dateRange.startDate);
        const endDate = getDate(budgetSegment.dateRange.endDate);
        if (!(startDate < todayDate && todayDate < endDate)) {
          continue;
        }
        if (
          insertionOrder.getInsertionOrderBudget().budgetUnit !==
          'BUDGET_UNIT_CURRENCY'
        ) {
          continue;
        }
        expandDateRanges(dateRange, startDate, endDate);
        results.push({
          campaignId: insertionOrder.getCampaignId(),
          displayName,
          insertionOrderId,
          startDate,
          endDate,
          settings,
          pacingType,
          budget: Number(budgetSegment.budgetAmountMicros) / 1_000_000,
        });
      }
    }
    if (!dateRange.earliestStartDate || !dateRange.latestEndDate) {
      return { values };
    }
    const budgetReport = this.client.getBudgetReport({
      startDate: dateRange.earliestStartDate,
      endDate: dateRange.latestEndDate,
    });
    for (const {
      budget,
      campaignId,
      displayName,
      insertionOrderId,
      startDate,
      endDate,
      settings,
      pacingType,
    } of results) {
      const startTimeSeconds = startDate.getTime();
      const endTimeSeconds = endDate.getTime();
      const flightDuration = endTimeSeconds - startTimeSeconds;
      const timeElapsed = today - startTimeSeconds;
      const spend = budgetReport.getSpendForInsertionOrder(
        insertionOrderId,
        startTimeSeconds,
        endTimeSeconds,
      );
      if (spend === undefined) {
        continue;
      }
      const budgetToFlightDuration =
        budget / (flightDuration / DAY_DENOMINATOR);
      const spendToTimeElapsed = spend / (timeElapsed / DAY_DENOMINATOR);
      const percent = spendToTimeElapsed / budgetToFlightDuration - 1;
      values[insertionOrderId] = humanReadableError(
        settings,
        pacingType,
        percent,
        {
          'Insertion Order ID': insertionOrderId,
          'Display Name': displayName,
          'Campaign ID': campaignId,
          'Flight Start': startDate.toDateString(),
          'Flight End': endDate.toDateString(),
          Spend: `$${spend.toString()}`,
          Budget: `$${budget.toString()}`,
          Pacing: `${(spendToTimeElapsed / budgetToFlightDuration) * 100}%`,
          'Days Elapsed': (timeElapsed / DAY_DENOMINATOR).toString(),
          'Flight Duration': (flightDuration / DAY_DENOMINATOR).toString(),
        },
      );
    }
    return { values };
  },
});

/**
 * Sets a violation if budget is pacing `days` ahead of schedule in a line item.
 *
 * Compares DBM spend against DV360 budgets over a flight duration.
 */
export const budgetPacingRuleLineItem = newRule({
  name: 'Budget Pacing by Days Ahead/Behind (Line Item)',
  description: `<p>Counts the number of days ahead or behind a Line Item is vs.
    plan. It uses the following formula: <code>((Budget / Plan Days) / 
    (Spend / Time Elapsed Since Duration Start)) * Time Elapsed Since Duration Start 
    - Time Elapsed Since Duration Start</code>.</p>
    <p>If budget is $100 for a planned 10 days total, and $50 have been spent on
    day one, then <code>(50/1) / (100/10) * 1 - 1 = 50 / 10 * 1 - 1 = 5 * 1 - 1 
    = 4</code> days ahead of budget.</p>`,
  valueFormat: {
    label: 'Days Ahead/Behind',
    numberFormat: '0.0',
  },
  params: {
    min: {
      label: 'Min. Percent Ahead/Behind',
      validationFormulas: RULES.LESS_THAN_MAX,
      defaultValue: '0',
    },
    max: {
      label: 'Max. Percent Ahead/Behind',
      validationFormulas: RULES.GREATER_THAN_MIN,
      defaultValue: '0.5',
    },
    pacingType: {
      label: 'Pacing Type',
      defaultValue: PACING_TYPE.AHEAD,
    },
  },
  granularity: RuleGranularity.LINE_ITEM,
  async callback() {
    type SettingsObj =
      typeof this.settings extends Settings<infer I> ? I : never;
    const rules: { [lineItemId: string]: AbridgedCheck } = {};
    const values: Values = {};
    const results: Array<{
      campaignId: string;
      displayName: string;
      lineItemId: string;
      budget: number;
      startDate: Date;
      endDate: Date;
      pacingType: PacingType;
      settings: SettingsObj;
    }> = [];
    const dateRange: { earliestStartDate?: Date; latestEndDate?: Date } = {};
    for (const lineItem of this.client.getAllLineItems()) {
      const budget = lineItem.getLineItemBudget();
      const flight = lineItem.getLineItemFlight().dateRange;
      if (!dateRange) {
        throw new Error(
          `Missing a date range in Line Item ${lineItem.getId()}`,
        );
      }
      const startDate = getDate(flight.startDate);
      const endDate = getDate(flight.endDate);
      expandDateRanges(dateRange, startDate, endDate);
      if (budget.budgetUnit !== 'BUDGET_UNIT_CURRENCY') {
        continue;
      }
      const pacingType = lineItem.getLineItemPacing().pacingType;
      const settings = this.settings.getOrDefault(lineItem.getId());
      results.push({
        campaignId: lineItem.getCampaignId(),
        displayName: lineItem.getDisplayName(),
        lineItemId: lineItem.getId(),
        startDate,
        endDate,
        settings,
        pacingType,
        budget: Number(budget.maxAmount) / 1_000_000,
      });
    }
    if (!dateRange.earliestStartDate || !dateRange.latestEndDate) {
      return { values };
    }
    const budgetReport = this.client.getLineItemBudgetReport({
      startDate: dateRange.earliestStartDate,
      endDate: dateRange.latestEndDate,
    });
    for (const {
      campaignId,
      displayName,
      lineItemId,
      budget,
      startDate,
      endDate,
      pacingType,
      settings,
    } of results) {
      const spend = budgetReport.getSpendForLineItem(lineItemId);
      if (spend === undefined) {
        continue;
      }
      const startTimeSeconds = startDate.getTime();
      const endTimeSeconds = endDate.getTime();
      const today = Date.now();
      const flightDuration = endTimeSeconds - startTimeSeconds;
      const timeElapsed = today - startTimeSeconds;
      if (spend === undefined) {
        continue;
      }
      const budgetToFlightDuration =
        budget / (flightDuration / DAY_DENOMINATOR);
      const spendToTimeElapsed = spend / (timeElapsed / DAY_DENOMINATOR);
      const percent = spendToTimeElapsed / budgetToFlightDuration - 1;
      values[lineItemId] = humanReadableError(settings, pacingType, percent, {
        'Line Item ID': lineItemId,
        'Display Name': displayName,
        'Campaign ID': campaignId,
        'Flight Start': startDate.toDateString(),
        'Flight End': endDate.toDateString(),
        Spend: `$${spend.toString()}`,
        Budget: `$${budget.toString()}`,
        Pacing: `${(spendToTimeElapsed / budgetToFlightDuration) * 100}%`,
        'Days Elapsed': (timeElapsed / DAY_DENOMINATOR).toString(),
        'Flight Duration': (flightDuration / DAY_DENOMINATOR).toString(),
      });
    }
    return { values };
  },
});

/**
 *  Checks if daily spend is outside the specified range `min` and `max`.
 */
export const dailyBudgetRule = newRule({
  name: 'Budget Per Day',
  description: `The expected daily budget of a campaign. This is a pre-launch
    rule. It's used to ensure that the set budget and flight have the desired
    daily output, ensuring there are no costly flight duration/budget mismatches.`,
  valueFormat: {
    label: 'Daily Budget',
    numberFormat: '0.00',
  },
  params: {
    min: {
      label: 'Min. Daily Budget',
      validationFormulas: RULES.LESS_THAN_MAX,
      defaultValue: '0',
    },
    max: {
      label: 'Max. Daily Budget',
      validationFormulas: RULES.GREATER_THAN_MIN,
      defaultValue: '1000000',
    },
  },
  granularity: RuleGranularity.INSERTION_ORDER,
  async callback() {
    const values: Values = {};

    for (const insertionOrder of this.client.getAllInsertionOrders()) {
      const insertionOrderId = insertionOrder.getId()!;
      const campaignSettings = this.settings.getOrDefault(insertionOrderId);
      const displayName = insertionOrder.getDisplayName();
      if (!displayName) {
        throw new Error('Missing ID or Display Name for Insertion Order.');
      }
      for (const dailyBudgets of checkPlannedDailyBudget(
        this.client,
        insertionOrder,
      )) {
        values[insertionOrderId] = inRange(
          {
            min: Number(campaignSettings.min),
            max: Number(campaignSettings.max),
          },
          dailyBudgets.dailyBudget,
          {
            'Insertion Order ID': insertionOrderId,
            'Display Name': displayName,
            Budget: dailyBudgets.budget.toString(),
            'Flight Duration': dailyBudgets.flightDurationDays.toString(),
          },
        );
      }
    }
    return { values };
  },
});

/**
 * Checks the daily spend against a budget.
 */
function checkPlannedDailyBudget(
  client: ClientInterface,
  insertionOrder: InsertionOrder,
): DailyBudget[] {
  const dailyBudgets: DailyBudget[] = [];
  for (const budgetSegment of insertionOrder.getInsertionOrderBudgetSegments()) {
    if (
      insertionOrder.getInsertionOrderBudget().budgetUnit !==
      'BUDGET_UNIT_CURRENCY'
    ) {
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
  range: { startDate: Date | undefined; endDate: Date | undefined },
  budgetSegment: InsertionOrderBudgetSegment,
  todayDate: Date,
) {
  const startDate = getDate(budgetSegment.dateRange.startDate);
  const endDate = getDate(budgetSegment.dateRange.endDate);
  if (!(startDate < todayDate && todayDate < endDate)) {
    return;
  }
  range.startDate =
    range.startDate && range.startDate < startDate
      ? range.startDate
      : startDate;
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
  description: `For any insertion order, ensures that there is a maximum of 
    X% impressions from outside of the country (2-digit country code
    from <a href="https://developers.google.com/google-ads/api/reference/data/geotargets">
    This list</a>)`,
  valueFormat: {
    label: '% Invalid Impressions',
    numberFormat: '0%',
  },
  params: {
    countries: {
      label: 'Allowed Countries (Comma Separated)',
      defaultValue: 'US',
    },
    maxOutside: {
      label: 'Max. Percent Outside Geos',
      validationFormulas: RULES.GREATER_THAN_MIN,
      defaultValue: '0.01',
    },
  },
  granularity: RuleGranularity.INSERTION_ORDER,
  helper: `=HYPERLINK(
    "https://developers.google.com/google-ads/api/reference/data/geotargets", "Use the 2-digit country codes found in this report.")`,
  async callback() {
    const values: Values = {};

    const range: { startDate: Date | undefined; endDate: Date | undefined } = {
      startDate: undefined,
      endDate: undefined,
    };

    const today = Date.now();
    const todayDate = new Date(today);
    const result: {
      [insertionOrderId: string]: { campaignId: string; displayName: string };
    } = {};

    for (const insertionOrder of this.client.getAllInsertionOrders()) {
      for (const budgetSegment of insertionOrder.getInsertionOrderBudgetSegments()) {
        calculateOuterBounds(range, budgetSegment, todayDate);
      }
      result[insertionOrder.getId()!] = {
        campaignId: insertionOrder.getCampaignId(),
        displayName: insertionOrder.getDisplayName() ?? '',
      };
    }

    if (!range.startDate || !range.endDate) {
      return { values };
    }
    const impressionReport = new this.client.dao.accessors.impressionReport!({
      idType: this.client.args.idType,
      id: this.client.args.id,
      ...(range as {
        startDate: Date;
        endDate: Date;
      }),
    });

    for (const [
      insertionOrderId,
      { campaignId, displayName },
    ] of Object.entries(result)) {
      const campaignSettings = this.settings.getOrDefault(insertionOrderId);
      const impressions = impressionReport.getImpressionPercentOutsideOfGeos(
        insertionOrderId,
        campaignSettings.countries
          .split(',')
          .map((country: string) => country.trim()),
      );
      values[insertionOrderId] = lessThanOrEqualTo(
        Number(campaignSettings.maxOutside),
        impressions,
        {
          'Insertion Order ID': insertionOrderId,
          'Display Name': displayName,
          'Campaign ID': campaignId,
        },
      );
    }
    return { values };
  },
});

function expandDateRanges(
  dateRange: { earliestStartDate?: Date; latestEndDate?: Date },
  startDate: Date,
  endDate: Date,
) {
  dateRange.earliestStartDate =
    dateRange.earliestStartDate && dateRange.earliestStartDate < startDate
      ? dateRange.earliestStartDate
      : startDate;
  dateRange.latestEndDate =
    dateRange.latestEndDate && dateRange.latestEndDate > endDate
      ? dateRange.latestEndDate
      : endDate;
}

function humanReadableError(
  settings: { min: string; max: string; pacingType: string },
  pacingType: PacingType,
  percent: number,
  fields: Record<string, string>,
) {
  const values: [pace: string, pacingType: string] = ['', ''];
  if (percent < Number(settings.min)) {
    values[0] = `${percent * 100}% (< ${Number(settings.min) * 100}%)`;
  } else if (percent > Number(settings.max)) {
    values[0] = `${percent * 100}% (> ${Number(settings.max) * 100}%)`;
  } else {
    values[0] = 'Pace OK';
  }
  if (settings.pacingType !== pacingType) {
    values[1] = `Pacing Type ${pacingType} != ${settings.pacingType}`;
  }
  const value = values[1] ? values.join('; ') : values[0];
  return {
    value,
    anomalous: value !== 'Pace OK',
    fields,
  };
}
