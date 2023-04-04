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

import {AbsoluteRule} from 'anomaly_library/absoluteRule';
import {Rule, ThresholdRuleInstructions, Values} from 'anomaly_library/main';
import {LockedSeriesRule, neverChangeAfterSet} from 'anomaly_library/seriesRule';

import {newRule} from './client';
import {campaignColumns, ReportRecord} from './sa360';

const ONE_DAY = 60 * 60 * 24;

interface CampaignStatusData {
  lastUpdated: number;
  records: CampaignStatusDataRecords;
}

type CampaignStatusDataRecords = Array<[status: string, count: number]>;

function toCampaignData(value: string): CampaignStatusDataRecords {
  return value.split(',').map(v => {
    const [status, count] = v.trim().split(' x ');
    return [status, Number(count)];
  });
}

function fromCampaignData(data: CampaignStatusDataRecords): string {
  return data.map(([status, count]) => `${status} x ${count}`).join(', ');
}

/**
 * Anomalous if campaign status has gone from inactive to active after N days.
 *
 * This is a somewhat complex rule because it matters how many days a value
 * has been set, and this rule might be checked hourly or even ad-hoc.
 */
export const campaignStatusRule = newRule({
  params: {
    daysInactive: {
      label: 'Max. Days Inactive before Active',
    },
  },
  defaults: {
    daysInactive: '0',
  },
  name: 'Campaign Status Active after Inactive',
  uniqueKeyPrefix: 'campaignStatusCheck',
  async callback() {
    const uniqueKey: string = this.getUniqueKey();
    const rules: {[campaignId: string]: Rule} = {};
    const rule = this.getRule();
    const values: Values = {};
    const oldValues = rule.getValues().reduce((prev, value) => {
      prev[value.fields!['Campaign ID']] = {lastUpdated: Number(value.fields!['Last Updated']), records: toCampaignData(value.value)};
      return prev;
    }, {} as {[key: string]: CampaignStatusData });

    const campaignReport = await this.client.getCampaignReport();
    const now = Date.now();
    for (const [campaignId, reportRow] of Object.entries(campaignReport.report)) {
      const valueArray: CampaignStatusData = oldValues[campaignId] ?? { records: [], lastUpdated: now };
      const moreThanOneDayOldStatus = now - valueArray.lastUpdated >= ONE_DAY;
      const thresholdValue = Number(this.settings.getOrDefault(campaignId).daysInactive);
      maybeAddToStatusCount(valueArray, reportRow.campaignStatus, moreThanOneDayOldStatus);
      // cull statuses with active/inactive/active under threshold
      for (let i = 0; i < valueArray.records.length; i++) {
        if (valueArray.records[i][0] === 'Active' && valueArray.records[i + 2] && valueArray.records[i + 1][0] === 'Paused' && valueArray.records[i + 1][1] <= thresholdValue && valueArray.records[i + 2][0] === 'Active') {
          valueArray.records.splice(i, 2);
        }
      }
      values[campaignId] = (rules[campaignId] ??= notActiveAfterPausedNDays({uniqueKey, thresholdValue})).createValue(fromCampaignData(valueArray.records), {
        'Campaign ID': reportRow.campaignId,
        'Campaign': reportRow.campaign,
        'Current Status': reportRow.campaignStatus,
        'Last Updated': String(valueArray.lastUpdated + (moreThanOneDayOldStatus ? ONE_DAY : 0)),
      });
    }
    return { rule, values };
  },
});

/**
 * Anomalous if an ad group has its status change.
 */
export const adGroupStatusRule = newRule({
  name: 'Ad Group Status Change',
  params: {},
  defaults: {},
  uniqueKeyPrefix: 'adGroupStatusChange',
  async callback() {
    const uniqueKey: string = this.getUniqueKey();
    const rules: {[adGroupId: string]: Rule} = {};
    const rule = this.getRule();
    const values: Values = {};

    const campaignReport = await this.client.getAdGroupReport();
    for (const [adGroupId, reportRow] of Object.entries(campaignReport.report)) {
      values[adGroupId] = ((rules[adGroupId] ??= neverChangeAfterSet({uniqueKey})) as LockedSeriesRule).createValueMessage(adGroupId,{'Status': reportRow.adGroupStatus}, {
        'Campaign ID': reportRow.campaignId,
        'Ad Group ID': reportRow.adGroupId,
        'Ad Group': reportRow.adGroup,
      });
    }
    return { rule, values };
  },
});

/**
 * Given a series, this rule is anomalous when 'Active', 'Paused'*N, 'Active' is true.
 *
 * If 1 is never seen, if 1 is the only thing seen, or if 1 is only >N times,
 * then this is not an error.
 */
export function notActiveAfterPausedNDays(instructions: ThresholdRuleInstructions<number>) {
  /**
   * @param thresholdValue The number of times a false value should be seen to make this anomalous.
   */
  return new AbsoluteRule(instructions, (thresholdValue) => (value) => {
    const valuesList = toCampaignData(value);
    let clockStarted = false;
    let maxConsecutiveFalse = -1;
    for (let i = 0; i < valuesList.length; i++) {
      const v = valuesList[i];
      if (v[0] === 'Active') {
        clockStarted = true;
      } else if (v[0] === 'Paused') {
        if (!clockStarted) {
          continue;
        }
        maxConsecutiveFalse = Math.max(maxConsecutiveFalse, v[1]);
      }
    }
    return clockStarted && maxConsecutiveFalse < 0 || maxConsecutiveFalse <= thresholdValue || valuesList[valuesList.length - 1][0] !== 'Active';
  });
}

/**
 * Conditionally updates a campaign status count.
 *
 * 1. If the last status is the same as this status, and it was last seen today
 *    then do nothing. If it was last seen a day ago or longer, add one day to
 *    the last status.
 * 2. If the last status is different from this status, and it has been less
 *    than a day since the last status update, then remove the decrement the
 *    last status. If it's been more than a day, don't decrement the last
 *    status. Add the new status in a new array.
 */
export function maybeAddToStatusCount(valueArray: CampaignStatusData, campaignStatus: string, moreThanOneDayOldStatus: boolean) {
  const lastStatusSameAsThisStatus = valueArray.records.length && valueArray.records[valueArray.records.length - 1][0] === campaignStatus;
  if (lastStatusSameAsThisStatus) {
    // only add a value if the last status is more than one day old.
    if (moreThanOneDayOldStatus) {
      ++valueArray.records[valueArray.records.length - 1][1];
    }
  } else {
    // remove the last value and replace it if the value is less than one
    // day old.
    if (!moreThanOneDayOldStatus && valueArray.records.length) {
      if (--valueArray.records[valueArray.records.length - 1][1] === 0) {
        valueArray.records.pop();
        ++valueArray.records[valueArray.records.length - 1][1];
        return;
      }
    }
    valueArray.records.push([campaignStatus, 1]);
  }
}
