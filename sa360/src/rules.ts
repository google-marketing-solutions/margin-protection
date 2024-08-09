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
 * @fileoverview General rules for SA360
 */

import { equalTo, inRange } from 'common/checks';

import { Value, Values } from 'common/types';

import { newRule } from './client';
import { RuleGranularity } from './types';
import {
  AD_GROUP_REPORT,
  AD_GROUP_USER_LIST_REPORT,
  AGE_TARGET_REPORT,
  CAMPAIGN_REPORT,
  CAMPAIGN_TARGET_REPORT,
  CAMPAIGN_PACING_REPORT,
  CAMPAIGN_USER_LIST_REPORT,
  GENDER_TARGET_REPORT,
} from './api';

const ONE_DAY = 60 * 60 * 1000 * 24;
const NO_CHANGES = 'No Changes';

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
 * Pacing rule for SA360.
 */
export const budgetPacingRule = newRule({
  name: 'Budget Pacing',
  description: 'Pacing',
  granularity: RuleGranularity.CAMPAIGN,
  valueFormat: { label: 'Budget/Spend' },
  params: {
    min: {
      label: 'Min. Percent Ahead/Behind',
      validationFormulas: RULES.LESS_THAN_MAX,
    },
    max: {
      label: 'Max. Percent Ahead/Behind',
      validationFormulas: RULES.GREATER_THAN_MIN,
    },
  },
  defaults: { min: '0', max: '0.5' },
  async callback() {
    const values: Values = {};
    const report = this.client.getReport(CAMPAIGN_PACING_REPORT).fetch();
    for (const campaignBudget of Object.values(report)) {
      const campaignSettings = this.settings.getOrDefault(
        campaignBudget.campaignId,
      );
      values[campaignBudget.campaignId] = inRange(
        {
          min: Number(campaignSettings.min),
          max: Number(campaignSettings.max),
        },
        Number(campaignBudget.spend) / Number(campaignBudget.budget),
        {
          campaignId: campaignBudget.campaignId,
          displayName: campaignBudget.campaignName,
          budget: String(Number(campaignBudget.budget) / 1e6),
          spend: String(Number(campaignBudget.spend) / 1e6),
        },
      );
    }

    return { values };
  },
});

/**
 * Anomalous if campaign status has gone from inactive to active after N days.
 *
 * This is a somewhat complex rule because it matters how many days a value
 * has been set, and this rule might be checked hourly or even ad-hoc.
 */
export const campaignStatusRule = newRule({
  name: 'Campaign Status Active after Inactive',
  description: `Checks to see if a campaign has become active again after being
    inactive for more than "daysInactive" days. The result is a list of statuses
    times the number of times it appears. For example,
    <code>Active x 1, Passive x 10, Active x 1</code> means that "this campaign
    was active, then passive for ten days in a row, then active again". If 
    "daysInactive" is ten or less in this example, then it would be an anomaly.`,
  params: {
    daysInactive: {
      label: 'Max. Days Inactive before Active',
    },
    status: {
      label: 'Status',
    },
    lastUpdated: {
      label: 'Last Updated',
    },
  },
  helper:
    'Status Code: A=Active, P=Permanently Paused, #=Days Paused, C=Closed, V=Violation',
  defaults: {
    daysInactive: '60',
    status: '',
    lastUpdated: '',
  },
  granularity: RuleGranularity.CAMPAIGN,
  valueFormat: { label: 'Invalid' },
  async callback() {
    const values: Values = {};
    const campaignReport = this.client.getReport(CAMPAIGN_REPORT);
    const now = Date.now();

    for (const [campaignId, reportRow] of Object.entries(
      campaignReport.fetch(),
    )) {
      const setting = this.settings.get(campaignId);
      const thresholdValue = 1;
      const daysSinceLastUpdate = Math.floor(
        (now - new Date(setting.lastUpdated).getTime()) / ONE_DAY,
      );
      setting.lastUpdated = new Date().toISOString();
      const statusStr = String(setting.status);
      const statusNum = Number(setting.status);
      const plusDays = isNaN(daysSinceLastUpdate) ? 1 : daysSinceLastUpdate;
      if (plusDays >= 1) {
        setting.lastUpdated = new Date().toISOString();
        if (reportRow.campaignStatus === 'Paused') {
          if (statusStr === 'A') {
            setting.status = '1';
          } else if (!isNaN(statusNum)) {
            setting.status = String(statusNum + plusDays);
          } else if (setting.status.startsWith('V')) {
            setting.status = String(Number(statusStr.slice(1)) + plusDays);
          } else {
            setting.status = '';
          }
        } else if (reportRow.campaignStatus === 'Active') {
          if (statusNum > Number(thresholdValue)) {
            setting.status = `V${setting.status}`;
          } else {
            setting.status = 'A';
          }
        } else if (reportRow.campaignStatus === 'Closed') {
          setting.status = 'C';
        }
      }
      values[campaignId] = equalTo(
        thresholdValue,
        setting.status === 'C' || String(setting.status).startsWith('V')
          ? 0
          : 1,
        {
          'Customer ID': reportRow.customerId,
          Customer: reportRow.customerName,
          'Campaign ID': reportRow.campaignId,
          Campaign: reportRow.campaignName,
          'Current Status': reportRow.campaignStatus,
        },
      );
      this.settings.set(reportRow.campaignId, setting);
    }
    return { values };
  },
});

/**
 * Anomalous if an ad group has its status change.
 */
export const adGroupStatusRule = newRule({
  name: 'Ad Group Status Change',
  description: `Ensures that an ad group does not change status. Status changes
    should always be set at the campaign level.`,
  params: {
    adGroupActive: {
      label: 'Ad Group Active',
    },
  },
  defaults: {
    adGroupActive: 'N',
  },
  granularity: RuleGranularity.AD_GROUP,
  valueFormat: { label: 'Change' },
  async callback() {
    const values: Values = {};

    const adGroupReport = this.client.getReport(AD_GROUP_REPORT);
    for (const [adGroupId, reportRow] of Object.entries(
      adGroupReport.fetch(),
    )) {
      const adGroupStatusActive =
        this.settings.getOrDefault(adGroupId).adGroupActive === 'Y';
      values[adGroupId] = equalTo(
        1,
        reportRow.adGroupStatus !== 'Removed' &&
          (!adGroupStatusActive || reportRow.adGroupStatus === 'Active')
          ? 1
          : 0,
        {
          'Customer ID': reportRow.customerId,
          Customer: reportRow.customerName,
          'Campaign ID': reportRow.campaignId,
          'Ad Group ID': reportRow.adGroupId,
          'Ad Group': reportRow.adGroupName,
          Status: reportRow.adGroupStatus,
        },
      );

      if (reportRow.adGroupStatus === 'Active') {
        this.settings.set(adGroupId, { adGroupActive: 'Y' });
      }
    }
    return { values };
  },
});

/**
 * Anomalous if an audience target has changed.
 *
 * Automatically adds audience target from the system to the settings sheet
 * if it's empty.
 */
export const adGroupAudienceTargetRule = newRule({
  name: 'Ad Group Audience Target Change',
  description: `Ensures that an audience target doesn't change once set.`,
  params: {
    userLists: {
      label: 'User Lists',
    },
  },
  defaults: {
    userLists: '',
  },
  granularity: RuleGranularity.AD_GROUP,
  valueFormat: { label: 'Change' },
  async callback() {
    const values: Values = {};
    const audienceReport = this.client.getReport(AD_GROUP_USER_LIST_REPORT);

    const aggregatedReport = aggregateReport(
      audienceReport.fetch(),
      'userListName',
    );
    for (const [adGroupId, [targets, fields]] of Object.entries(
      aggregatedReport,
    )) {
      const setting = this.settings.get(adGroupId).userLists.split(',');

      values[adGroupId] = trackSettingsChanges({
        stored: setting,
        targets,
        fields,
      });
      this.settings.set(adGroupId, {
        userLists: setting.join(','),
      });
    }
    return { values };
  },
});

/**
 * Anomalous if an age target doesn't match expectations.
 *
 * Automatically adds gender target from the system to the settings sheet
 * if it's empty.
 */
export const ageTargetRule = newRule({
  name: 'Age Target Change',
  description: `Ensures that an age target doesn't change once set.`,
  params: {
    ageTargetAgeRange: {
      label: 'Age Range',
    },
  },
  defaults: {
    ageTargetAgeRange: '',
  },
  granularity: RuleGranularity.AD_GROUP,
  valueFormat: { label: 'Change' },
  async callback() {
    const values: Values = {};

    const ageReport = this.client.getReport(AGE_TARGET_REPORT);

    const aggregatedReport = aggregateReport(ageReport.fetch(), 'ageRange');
    for (const [adGroupId, [targets, fields]] of Object.entries(
      aggregatedReport,
    )) {
      const setting = this.settings.get(adGroupId).ageTargetAgeRange.split(',');

      values[adGroupId] = trackSettingsChanges({
        stored: setting,
        targets,
        fields,
      });
      this.settings.set(adGroupId, { ageTargetAgeRange: setting.join(',') });
    }
    return { values };
  },
});

/**
 * Anomalous if a gender target doesn't match expectations.
 *
 * Automatically adds gender target from the system to the settings sheet
 * if it's empty.
 */
export const genderTargetRule = newRule({
  name: 'Gender Target Change',
  description: `Ensures that a gender target doesn't change once set.`,
  params: {
    genderTargetGenderType: {
      label: 'Gender Type',
    },
  },
  defaults: {
    genderTargetGenderType: '',
  },
  granularity: RuleGranularity.AD_GROUP,
  valueFormat: { label: 'Change' },
  async callback() {
    const values: Values = {};

    const genderReport = this.client.getReport(GENDER_TARGET_REPORT);

    const aggregatedReport = aggregateReport(genderReport.fetch(), 'gender');
    for (const [adGroupId, [targets, fields]] of Object.entries(
      aggregatedReport,
    )) {
      const setting = this.settings
        .get(adGroupId)
        .genderTargetGenderType.split(',');

      values[adGroupId] = trackSettingsChanges({
        stored: setting,
        targets,
        fields,
      });
      this.settings.set(adGroupId, {
        genderTargetGenderType: setting.join(','),
      });
    }
    return { values };
  },
});

/**
 * Anomalous if a location doesn't match expectations.
 *
 * Automatically adds location from the system to the settings sheet
 * if it's empty.
 */
export const geoTargetRule = newRule({
  name: 'Geo Target Change',
  description: `Ensures that a geotarget doesn't change once set.`,
  params: {
    criteriaIds: {
      label: 'Criteria IDs',
      numberFormat: '0',
    },
  },
  defaults: {
    criteriaIds: '',
  },
  granularity: RuleGranularity.CAMPAIGN,
  helper: `=HYPERLINK(
    "https://developers.google.com/google-ads/api/reference/data/geotargets", "Refer to the Criteria ID found in this report.")`,
  valueFormat: { label: 'Change' },
  async callback() {
    const values: Values = {};

    const geoReport = this.client.getReport(CAMPAIGN_TARGET_REPORT);

    const aggregatedReport = aggregateReport(geoReport.fetch(), 'criterionId');
    for (const [campaignId, [targets, fields]] of Object.entries(
      aggregatedReport,
    )) {
      const setting = String(this.settings.get(campaignId).criteriaIds).split(
        /[;,]/g,
      );

      values[campaignId] = trackSettingsChanges({
        stored: setting,
        targets,
        fields,
      });
      this.settings.set(campaignId, { criteriaIds: "'" + setting.join(';') });
    }
    return { values };
  },
});

/**
 * Anomalous if an audience target has changed.
 *
 * Automatically adds audience target from the system to the settings sheet
 * if it's empty.
 */
export const campaignAudienceTargetRule = newRule({
  name: 'Campaign Audience Target Change',
  description: `Ensures that an audience target doesn't change once set.`,
  params: {
    userLists: {
      label: 'User Lists',
    },
  },
  defaults: {
    userLists: '',
  },
  granularity: RuleGranularity.CAMPAIGN,
  valueFormat: { label: 'Change' },
  async callback() {
    const values: Values = {};

    const audienceReport = this.client.getReport(CAMPAIGN_USER_LIST_REPORT);
    const aggregatedReport = aggregateReport(
      audienceReport.fetch(),
      'userListName',
    );
    for (const [adGroupId, [targets, fields]] of Object.entries(
      aggregatedReport,
    )) {
      const setting = this.settings.get(adGroupId).userLists.split(',');

      values[adGroupId] = trackSettingsChanges({
        stored: setting,
        targets,
        fields,
      });
      this.settings.set(adGroupId, {
        userLists: setting.join(','),
      });
    }
    return { values };
  },
});

/**
 * Used for creating a value message.
 */
interface TrackSettingsChangeArgs {
  /**
   * A list of stored settings which are compared against for changes.
   * They have the same keys as {@link args.targets}
   */
  stored: string[];
  /**
   * A key/value pair object with the unique key as key. These are the new
   * values from the API.
   */
  targets: string[];
  /**
   * Extra metadata that's used in reporting.
   */
  fields: { [key: string]: string };
}

/**
 * Convenience method creates human-readable {@link Values} for settings.
 *
 * Tracks any changes and, if none, sets "No Changes" as the value.
 *
 * The return will show what values have been added or deleted since the initial
 * settings were recorded, or "No Changes" if there have been no changes.
 * Anything other than "No Changes" is registered as an anomaly.
 */
export function trackSettingsChanges(
  settingsChangeArgs: TrackSettingsChangeArgs,
): Value {
  const settings = new Set(settingsChangeArgs.stored);
  // targets are in the format ['a,b,c', 'd,e,f'] so we need to combine then
  // re-split them.
  const targetsSet = new Set(settingsChangeArgs.targets.join(',').split(','));
  const newValues: string[] = [];
  for (const setting of settings) {
    if (setting && !targetsSet.has(setting)) {
      newValues.push(`${setting} DELETED`);
    } else {
      targetsSet.delete(setting);
    }
  }
  for (const target of targetsSet) {
    newValues.push(`${target} ADDED`);
    if (settingsChangeArgs.stored.join(',') === '') {
      settings.add(target);
    }
  }
  settingsChangeArgs.stored.splice(
    0,
    settingsChangeArgs.stored.length,
    ...settings,
  );
  return objectEquals(
    newValues.join(', ') || NO_CHANGES,
    settingsChangeArgs.fields,
  );
}

function objectEquals(value: string, fields: { [fieldName: string]: string }) {
  return { value, anomalous: value !== NO_CHANGES, fields };
}

function aggregateReport<
  ReportRow extends {
    customerId: string;
    customerName: string;
    campaignId: string;
  },
  CampaignLevel extends boolean = false,
>(report: { [criterionId: string]: ReportRow }, key: keyof ReportRow) {
  const aggregatedReport: {
    [adGroupId: string]: [
      values: string[],
      fields: { [fieldName: string]: string },
    ];
  } = {};

  type ContextualReportRow = ReportRow & { adGroupId?: string };
  for (const reportRow of Object.values<ContextualReportRow>(
    report as unknown as { [criterionId: string]: ContextualReportRow },
  )) {
    if (!aggregatedReport[reportRow.adGroupId ?? reportRow.campaignId]) {
      aggregatedReport[reportRow.adGroupId ?? reportRow.campaignId] = [
        [],
        {
          'Customer ID': reportRow.customerId,
          'Customer Name': reportRow.customerName,
          'Campaign ID': reportRow.campaignId,
          ...(reportRow.adGroupId
            ? {
                'Ad Group ID': reportRow.adGroupId,
              }
            : {}),
        },
      ];
    }
    aggregatedReport[reportRow.adGroupId ?? reportRow.campaignId][0].push(
      reportRow[key] as string,
    );
  }
  return aggregatedReport;
}
