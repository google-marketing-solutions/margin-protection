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
 * @fileoverview The test for the new SA360 rules.
 */

import {
  FakePropertyStore,
  mockAppsScript,
} from 'common/test_helpers/mock_apps_script';
import { bootstrapGoogleAdsApi, iterator } from 'common/tests/helpers';
import { ParamDefinition, RuleExecutor, Values } from 'common/types';
import { Client } from 'sa360/client';
import { SearchAdsClientTypes } from 'sa360/types';
import { ReportClass } from 'common/ads_api_types';
import {
  AD_GROUP_USER_LIST_REPORT,
  CAMPAIGN_TARGET_REPORT,
  CAMPAIGN_USER_LIST_REPORT,
  CAMPAIGN_PACING_REPORT,
  AD_GROUP_REPORT,
  AGE_TARGET_REPORT,
  GENDER_TARGET_REPORT,
} from 'sa360/api';

import {
  budgetPacingRule,
  adGroupAudienceTargetRule,
  adGroupStatusRule,
  campaignAudienceTargetRule,
  campaignStatusRule,
  geoTargetRule,
  ageTargetRule,
  genderTargetRule,
} from '../rules';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

describe('Campaign pacing rule', () => {
  beforeEach(() => {
    mockAppsScript();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    FakePropertyStore.clearCache();
  });

  it('shows pacing is OK when it is between min and max', async function () {
    const costs = [
      { budget: 100, spend: 90 },
      { budget: 100, spend: 50 },
    ];
    const value = await generateCampaignPacingTestData(costs, [
      [
        'Campaign ID',
        'Campaign',
        'Min. Percent Ahead/Behind',
        'Max. Percent Ahead/Behind',
      ],
      ['default', '', '0', '1'],
      ['C1', '', '0.5', '1'],
      ['C2', '', '0.95', '1'],
    ]);
    expect(value['C1'].anomalous).to.be.false;
    expect(value['C2'].anomalous).toBe(true);
  });

  it('fails to pace when there is no cost', async function () {
    const costs = [{ budget: 100 }];
    const value = await generateCampaignPacingTestData(costs, [
      [
        'Campaign ID',
        'Campaign',
        'Min. Percent Ahead/Behind',
        'Max. Percent Ahead/Behind',
      ],
      ['default', '', '0', '1'],
      ['C1', '', '0.5', '1'],
      ['C2', '', '0.95', '1'],
    ]);
    expect(value['C1'].fields['spend']).to.equal('0');
  });
});

/**
 *
 * Generates geo test data for the tests below.
 */
async function generateCampaignPacingTestData(
  pacings: Array<{ budget: number; spend?: number }>,
  columns: string[][],
) {
  const { reportFactory, api } = bootstrapGoogleAdsApi();
  const client = new Client(
    {
      customerIds: '1',
      label: 'test',
    },
    new FakePropertyStore(),
    reportFactory,
  );
  client.addRule(budgetPacingRule, columns);
  const obj = {
    campaign: {
      id: 'C1',
      name: 'Campaign 1',
      status: 'ACTIVE',
    },
    campaignBudget: {
      amountMicros: '1000000', // 1.00 USD
    },
  };

  let values: Values = {};
  const mockGetReport = vi.spyOn(client, 'getReport');
  const mockQuery = vi.spyOn(api, 'query');

  for (const [i, { budget, spend }] of pacings.entries()) {
    obj.campaign.id = `C${i + 1}`;
    if (spend) {
      (obj as unknown as { metrics?: { costMicros?: string } }).metrics = {
        costMicros: `${spend * 1e6}`,
      };
    }
    obj.campaignBudget.amountMicros = `${budget * 1e6}`;
    mockQuery.mockReturnValue(iterator(obj));
    mockGetReport.mockImplementation((reportClass) => {
      queryEquals(reportClass, CAMPAIGN_PACING_REPORT);
      const report = client.reportFactory.create(reportClass);
      return report;
    });
    const { results, rules } = await client.validate();
    writeBackToColumns(rules, columns);
    values = { ...values, ...(results['Budget Pacing']?.values || {}) };
  }
  return values;
}

function writeBackToColumns(
  rules: Record<
    string,
    RuleExecutor<SearchAdsClientTypes, Record<string, ParamDefinition>>
  >,
  columns: string[][],
) {
  for (const rule of Object.values(rules)) {
    for (let i = 1; i < columns.length; i++) {
      if (columns[i].slice(2).filter((c) => c).length) {
        continue;
      }
      columns[i] = [
        columns[i][0],
        columns[i][1],
        ...Object.values<string>(rule.settings.get(columns[i][0])),
      ];
    }
  }
}

describe('Campaign Status rule', () => {
  beforeEach(() => {
    mockAppsScript();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    FakePropertyStore.clearCache();
  });
  for (const statuses of [
    ['Active', 'Paused', 'Paused', 'Paused'],
    ['Paused', 'Active', 'Active'],
    ['Active', 'Paused', 'Active', 'Paused', 'Active', 'Paused', 'Active'],
    // back to paused - no longer anomalous
    ['Active', 'Paused', 'Paused', 'Active', 'Paused'],
  ]) {
    it(`is not anomalous because ${statuses} is not anomalous`, async function () {
      const value = await generateCampaignStatusTestData(
        statuses.map((campaignStatus: string) => ({ campaignStatus })),
        [
          ['Campaign ID', 'Campaign', 'Max. Days Inactive before Active'],
          ['default', '', '1'],
        ],
      );
      expect(value['C1'].anomalous).to.be.false;
    });
  }
  for (const statuses of [
    ['Active', 'Paused', 'Paused', 'Active'],
    [
      'Active',
      'Paused',
      'Paused',
      'Active',
      'Paused',
      'Active',
      'Paused',
      'Active',
    ],
    ['Paused', 'Paused', 'Paused', 'Active'],
  ]) {
    it(`is anomalous because ${statuses.join(
      ',',
    )} is over the threshold.`, async function () {
      const value = await generateCampaignStatusTestData(
        statuses.map((campaignStatus: string) => ({ campaignStatus })),
        [
          [
            'Campaign ID',
            'Campaign',
            'Max. Days Inactive before Active',
            'Status',
          ],
          ['default', '', '1', ''],
          ['C1', '', '', ''],
        ],
      );
      expect(value['C1'].anomalous).toBe(true);
    });
  }
});

describe('Ad Group status rule', () => {
  beforeEach(() => {
    mockAppsScript();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    FakePropertyStore.clearCache();
  });

  it('Status "Removed" is anomalous', async function () {
    const value = await generateAdGroupStatusTestData(
      [{ adGroupStatus: 'Removed' }],
      [
        ['Campaign ID', 'Campaign'],
        ['default', ''],
      ],
    );
    expect(value['AG1'].anomalous).toBe(true);
  });

  it('Status "Paused" is not anomalous if it has never been active', async function () {
    const value = await generateAdGroupStatusTestData(
      [{ adGroupStatus: 'Paused' }],
      [
        ['Campaign ID', 'Campaign'],
        ['default', ''],
      ],
    );
    expect(value['AG1'].anomalous).to.be.false;
  });

  it('Status "Active" is not anomalous', async function () {
    const value = await generateAdGroupStatusTestData(
      [{ adGroupStatus: 'Active' }],
      [
        ['Campaign ID', 'Campaign'],
        ['default', ''],
      ],
    );
    expect(value['AG1'].anomalous).to.be.false;
  });

  it('Status "Paused" is anomalous if it follows an "Active" state', async function () {
    const value = await generateAdGroupStatusTestData(
      [{ adGroupStatus: 'Active' }, { adGroupStatus: 'Paused' }],
      [
        ['Campaign ID', 'Campaign'],
        ['default', ''],
      ],
    );
    expect(value['AG1'].anomalous).toBe(true);
  });
});

describe('Ad Group target rule', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  afterEach(function () {
    SpreadsheetApp.getActive()
      .getActiveSheet()
      .getRange('A1:D4')
      .setValues(
        Array.from<string[]>({ length: 4 }).fill(
          Array.from<string>({ length: 4 }).fill(''),
        ),
      );
  });

  it('target unchanged is OK', async function () {
    const value = await generateAdGroupAudienceTestData(
      [
        { userLists: 'User List 1,User List 2' },
        { userLists: 'User List 1,User List 2' },
      ],
      [
        ['Ad Group ID', 'Ad Group'],
        ['default', ''],
      ],
    );
    expect(value['AG1'].anomalous).to.be.false;
  });

  it('has a legible value change value', async function () {
    const value = await generateAdGroupAudienceTestData(
      [
        { userLists: 'User List 1,User List 2,User List 3' },
        { userLists: 'User List 3,User List 4' },
      ],
      [
        ['Ad Group ID', 'User Lists'],
        ['default', '', '', '', ''],
        ['AG1', '', '', '', ''],
      ],
    );
    expect(value['AG1'].value).to.equal(
      'User List 1 DELETED, User List 2 DELETED, User List 4 ADDED',
    );
  });

  it('respects what is written in the sheet', async function () {
    const value = await generateAdGroupAudienceTestData(
      [
        { userLists: 'User List 1,User List 2,User List 3' },
        { userLists: 'User List 3,User List 4' },
      ],
      [
        ['Ad Group ID', 'User Lists'],
        ['default', ''],
        ['AG1', 'User List 4'],
      ],
    );

    expect(value['AG1'].value).to.equal('User List 3 ADDED');
  });
});

describe('Campaign user list', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  afterEach(function () {
    FakePropertyStore.clearCache();
  });

  it('target unchanged is OK', async function () {
    const value = await generateCampaignAudienceTestData(
      [
        { userLists: 'User List 1,User List 2' },
        { userLists: 'User List 1,User List 2' },
      ],
      [
        ['Campaign ID', 'Ad Group'],
        ['default', ''],
      ],
    );

    expect(value['C1'].anomalous).to.be.false;
  });

  it('has a legible value change value', async function () {
    const value = await generateCampaignAudienceTestData(
      [
        { userLists: 'User List 1,User List 2,User List 3' },
        { userLists: 'User List 3,User List 4' },
      ],
      [
        ['Campaign ID', 'User Lists'],
        ['default', '', '', '', ''],
        ['C1', '', '', '', ''],
      ],
    );

    expect(value['C1'].value).to.equal(
      'User List 1 DELETED, User List 2 DELETED, User List 4 ADDED',
    );
  });
});

describe('Geo target change', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  afterEach(function () {
    FakePropertyStore.clearCache();
  });

  it('target unchanged is OK', async function () {
    const value = await generateGeoTargetTestData(
      [
        { criterionId: 'criterion/1' },
        { criterionId: 'criterion/2' },
        { criterionId: 'criterion/1' },
      ],
      [
        ['Campaign ID', 'Criteria IDs'],
        ['default', ''],
      ],
    );

    expect(value['C1'].anomalous).to.be.false;
  });

  it('has a legible value change value', async function () {
    const value = await generateGeoTargetTestData(
      [{ criterionId: 'criterion/1' }, { criterionId: 'criterion/2' }],
      [
        ['Campaign ID', 'Criteria IDs'],
        ['default', ''],
      ],
    );

    expect(value['C1'].value).to.equal(
      'criterion/1 DELETED, criterion/2 ADDED',
    );
  });
});

describe('Ad group status change', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  afterEach(function () {
    FakePropertyStore.clearCache();
  });

  it('target unchanged is OK', async function () {
    const value = await generateAdGroupStatusReportTestData(
      [
        { adGroupStatus: 'Active' },
        { adGroupStatus: 'Paused' },
        { adGroupStatus: 'Active' },
      ],
      [
        ['Ad Group ID', 'Ad Group Active'],
        ['default', ''],
      ],
    );

    expect(value['AG1'].anomalous).to.be.false;
  });

  it('has a legible value change value', async function () {
    const value = await generateAdGroupStatusReportTestData(
      [{ adGroupStatus: 'Active' }, { adGroupStatus: 'Paused' }],
      [
        ['Ad Group ID', 'Ad Group Active'],
        ['default', ''],
      ],
    );

    expect(value['AG1'].value).to.equal('0');
    expect(value['AG1'].anomalous).to.equal(true);
  });
});

describe('Age target rule', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  afterEach(function () {
    SpreadsheetApp.getActive()
      .getActiveSheet()
      .getRange('A1:D4')
      .setValues(
        Array.from<string[]>({ length: 4 }).fill(
          Array.from<string>({ length: 4 }).fill(''),
        ),
      );
  });

  it('target unchanged is OK', async function () {
    const value = await generateAgeTargetTestData(
      [
        { ageRange: '18-24,25-34' },
        { ageRange: '35-44' },
        { ageRange: '18-24,25-34' },
      ],
      [
        ['Ad Group ID', 'Age Range'],
        ['default', ''],
        ['AG1', ''],
      ],
    );
    expect(value['AG1'].anomalous).to.be.false;
  });

  it('has a legible value change value', async function () {
    const value = await generateAgeTargetTestData(
      [{ ageRange: '18-24,35-44' }, { ageRange: '25-34,45-54' }],
      [
        ['Ad Group ID', 'Age Range'],
        ['default', '', '', '', ''],
        ['AG1', '', '', '', ''],
      ],
    );
    expect(value['AG1'].value).to.equal(
      '18-24 DELETED, 35-44 DELETED, 25-34 ADDED, 45-54 ADDED',
    );
  });

  it('respects what is written in the sheet', async function () {
    const value = await generateAgeTargetTestData(
      [{ ageRange: '18-24,25-34,35-44' }, { ageRange: '25-34,45-54' }],
      [
        ['Ad Group ID', 'Age Range'],
        ['default', ''],
        ['AG1', '45-54'],
      ],
    );

    expect(value['AG1'].value).to.equal('25-34 ADDED');
  });
});

describe('Gender target rule', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  afterEach(function () {
    SpreadsheetApp.getActive()
      .getActiveSheet()
      .getRange('A1:D4')
      .setValues(
        Array.from<string[]>({ length: 4 }).fill(
          Array.from<string>({ length: 4 }).fill(''),
        ),
      );
  });

  it('target unchanged is OK', async function () {
    const value = await generateGenderTargetTestData(
      [
        { gender: 'MALE,FEMALE' },
        { gender: 'UNKNOWN' },
        { gender: 'MALE,FEMALE' },
      ],
      [
        ['Ad Group ID', 'Gender Type'],
        ['default', ''],
      ],
    );
    expect(value['AG1'].anomalous).to.be.false;
  });

  it('has a legible value change value', async function () {
    const value = await generateGenderTargetTestData(
      [{ gender: 'MALE,UNKNOWN' }, { gender: 'FEMALE' }],
      [
        ['Ad Group ID', 'Gender Type'],
        ['default', '', '', '', ''],
        ['AG1', '', '', '', ''],
      ],
    );
    expect(value['AG1'].value).to.equal(
      'MALE DELETED, UNKNOWN DELETED, FEMALE ADDED',
    );
  });

  it('respects what is written in the sheet', async function () {
    const value = await generateGenderTargetTestData(
      [{ gender: 'MALE,FEMALE,UNKNOWN' }, { gender: 'FEMALE,UNKNOWN' }],
      [
        ['Ad Group ID', 'Gender Type'],
        ['default', ''],
        ['AG1', 'UNKNOWN'],
      ],
    );

    expect(value['AG1'].value).to.equal('FEMALE ADDED');
  });
});

/**
 * Generates geo test data for the tests below.
 */
async function generateCampaignStatusTestData(
  pacings: Array<{ campaignStatus: string }>,
  columns: string[][],
) {
  const { reportFactory, api } = bootstrapGoogleAdsApi();
  const client = new Client(
    {
      customerIds: '1',
      label: 'test',
    },
    new FakePropertyStore(),
    reportFactory,
  );
  client.addRule(campaignStatusRule, columns);
  const obj = {
    customer: {
      id: '1',
      name: 'Customer 1',
    },
    campaign: {
      id: 'C1',
      name: 'Campaign 1',
      status: 'ACTIVE',
    },
  };

  let values: Values = {};
  const mockQuery = vi.spyOn(api, 'query');
  for (const [i, { campaignStatus }] of pacings.entries()) {
    vi.setSystemTime(new Date(60 * 60 * 24 * 1000 * i));
    obj.campaign.status = campaignStatus;
    mockQuery.mockReturnValue(iterator(obj));
    const { results, rules } = await client.validate();
    writeBackToColumns(rules, columns);
    values = {
      ...values,
      ...(results['Campaign Status Active after Inactive']?.values || {}),
    };
  }

  return values;
}

async function generateAdGroupStatusTestData(
  pacings: Array<{ adGroupStatus: string }>,
  columns: string[][],
) {
  const { reportFactory, api } = bootstrapGoogleAdsApi();
  const client = new Client(
    {
      customerIds: '1',
      label: 'test',
    },
    new FakePropertyStore(),
    reportFactory,
  );
  client.addRule(adGroupStatusRule, columns);
  const obj = {
    customer: {
      id: '1',
      name: 'Customer 1',
    },
    campaign: {
      id: 'C1',
    },
    adGroup: {
      id: 'AG1',
      status: 'ACTIVE',
    },
  };
  let values: Values = {};
  const mockQuery = vi.spyOn(api, 'query');
  const mockGetReport = vi.spyOn(client, 'getReport');
  for (const [i, { adGroupStatus }] of pacings.entries()) {
    vi.setSystemTime(new Date(60 * 60 * 24 * 1000 * i));
    obj.adGroup.status = adGroupStatus;
    mockQuery.mockReturnValue(iterator(obj));
    mockGetReport.mockImplementation((reportClass) => {
      queryEquals(reportClass, AD_GROUP_REPORT);
      const report = client.reportFactory.create(reportClass);
      return report;
    });
    const { results, rules } = await client.validate();
    writeBackToColumns(rules, columns);
    values = {
      ...values,
      ...(results['Ad Group Status Change']?.values || {}),
    };
  }
  return values;
}

/**
 * Generates ad group data for the tests below.
 */
async function generateAdGroupAudienceTestData(
  overrides: Array<Record<string, string | undefined>>,
  columns: string[][],
): Promise<Values> {
  const { reportFactory } = bootstrapGoogleAdsApi();
  const client = new Client(
    {
      customerIds: 'C1',
      label: 'test',
    },
    new FakePropertyStore(),
    reportFactory,
  );
  client.addRule(adGroupAudienceTargetRule, columns);
  const mockGetReport = vi.spyOn(client, 'getReport');
  let values: Values = {};
  const obj = {
    criterionId: 'cr1',
    customerId: '1',
    customerName: 'Customer 1',
    campaignId: 'C1',
    adGroupId: 'AG1',
    adGroupName: 'Ad Group 1',
    userListName: '',
  };
  for (const { userLists } of overrides.values()) {
    mockGetReport.mockImplementation((reportClass) => {
      queryEquals(reportClass, AD_GROUP_USER_LIST_REPORT);
      const report = client.reportFactory.create(reportClass);
      const reportGetter = vi.spyOn(report, 'fetch');
      obj.userListName = userLists as string;
      reportGetter.mockReturnValue({ AG1: obj });
      return report;
    });
    const { results, rules } = await client.validate();
    writeBackToColumns(rules, columns);
    values = results['Ad Group Audience Target Change']?.values || {};
  }
  return values;
}

/**
 * Generates campaign user list data for the tests below.
 */
async function generateCampaignAudienceTestData(
  overrides: Array<Record<string, string | undefined>>,
  columns: string[][],
): Promise<Values> {
  const { reportFactory } = bootstrapGoogleAdsApi();
  const client = new Client(
    {
      customerIds: 'C1',
      label: 'test',
    },
    new FakePropertyStore(),
    reportFactory,
  );
  client.addRule(campaignAudienceTargetRule, columns);

  const mockGetReport = vi.spyOn(client, 'getReport');
  let values: Values = {};

  const obj = {
    criterionId: 'cr1',
    customerId: '1',
    customerName: 'Customer 1',
    campaignId: 'C1',
    campaignName: 'Campaign 1',
    userListName: '',
    userListType: 'USER_LIST',
  };
  for (const { userLists } of overrides.values()) {
    mockGetReport.mockImplementation((reportClass) => {
      queryEquals(reportClass, CAMPAIGN_USER_LIST_REPORT);
      const report = client.reportFactory.create(reportClass);
      const reportGetter = vi.spyOn(report, 'fetch');
      obj.userListName = userLists as string;
      reportGetter.mockReturnValue({ C1: obj });
      return report;
    });
    const { results, rules } = await client.validate();
    writeBackToColumns(rules, columns);
    values = results['Campaign Audience Target Change']?.values || {};
  }
  expect(mockGetReport).toHaveBeenCalled();
  return values;
}

/**
 * Generates geo target data for the tests below.
 */
async function generateGeoTargetTestData(
  overrides: Array<Record<string, string | undefined>>,
  columns: string[][],
): Promise<Values> {
  const { reportFactory } = bootstrapGoogleAdsApi();
  const client = new Client(
    {
      customerIds: 'C1',
      label: 'test',
    },
    new FakePropertyStore(),
    reportFactory,
  );
  client.addRule(geoTargetRule, columns);

  const mockGetReport = vi.spyOn(client, 'getReport');

  let values: Values = {};

  const obj = {
    criterionId: 'geo1',
    customerId: '1',
    location: 'Location 1',
    customerName: 'Customer 1',
    campaignId: 'C1',
    campaignName: 'Campaign 1',
  };
  for (const { criterionId } of overrides.values()) {
    mockGetReport.mockImplementation((reportClass) => {
      queryEquals(reportClass, CAMPAIGN_TARGET_REPORT);
      const report = client.reportFactory.create(reportClass);
      const reportGetter = vi.spyOn(report, 'fetch');
      obj.criterionId = criterionId!;
      reportGetter.mockReturnValue({ geo1: obj });
      return report;
    });
    const { results, rules } = await client.validate();
    writeBackToColumns(rules, columns);
    values = results['Geo Target Change']?.values || {};
    expect(mockGetReport).toHaveBeenCalled();
  }
  return values;
}

async function generateAdGroupStatusReportTestData(
  overrides: Array<Record<string, string | undefined>>,
  columns: string[][],
) {
  const { reportFactory } = bootstrapGoogleAdsApi();
  const client = new Client(
    {
      customerIds: 'C1',
      label: 'test',
    },
    new FakePropertyStore(),
    reportFactory,
  );
  client.addRule(adGroupStatusRule, columns);

  const mockGetReport = vi.spyOn(client, 'getReport');

  let values: Values = {};

  const obj = {
    customerId: '1',
    customerName: 'Customer 1',
    campaignId: 'C1',
    campaignName: 'Campaign 1',
    adGroupId: 'AG1',
    adGroupName: 'Ad Group 1',
    adGroupStatus: 'ACTIVE',
  };

  for (const { adGroupStatus } of overrides.values()) {
    mockGetReport.mockImplementation((reportClass) => {
      queryEquals(reportClass, AD_GROUP_REPORT);
      const report = client.reportFactory.create(reportClass);
      const reportGetter = vi.spyOn(report, 'fetch');
      obj.adGroupStatus = adGroupStatus!;
      reportGetter.mockReturnValue({ AG1: obj });
      return report;
    });
    const { results, rules } = await client.validate();
    writeBackToColumns(rules, columns);
    values = results['Ad Group Status Change']?.values || {};
    expect(mockGetReport).toHaveBeenCalled();
  }
  return values;
}

async function generateAgeTargetTestData(
  overrides: Array<Record<string, string | undefined>>,
  columns: string[][],
) {
  const { reportFactory } = bootstrapGoogleAdsApi();
  const client = new Client(
    {
      customerIds: 'C1',
      label: 'test',
    },
    new FakePropertyStore(),
    reportFactory,
  );

  client.addRule(ageTargetRule, columns);

  const mockGetReport = vi.spyOn(client, 'getReport');

  let values: Values = {};

  const obj = {
    criterionId: 'age1',
    customerId: '1',
    customerName: 'Customer 1',
    campaignId: 'C1',
    adGroupId: 'AG1',
    ageRange: '18-24',
  };

  for (const { ageRange } of overrides.values()) {
    mockGetReport.mockImplementation((reportClass) => {
      queryEquals(reportClass, AGE_TARGET_REPORT);
      const report = client.reportFactory.create(reportClass);
      const reportGetter = vi.spyOn(report, 'fetch');
      obj.ageRange = ageRange!;
      reportGetter.mockReturnValue({ age1: obj });
      return report;
    });
    const { results, rules } = await client.validate();
    writeBackToColumns(rules, columns);
    values = results['Age Target Change']?.values || {};
    expect(mockGetReport).toHaveBeenCalled();
  }
  return values;
}

async function generateGenderTargetTestData(
  overrides: Array<Record<string, string | undefined>>,
  columns: string[][],
) {
  const { reportFactory } = bootstrapGoogleAdsApi();
  const client = new Client(
    {
      customerIds: 'C1',
      label: 'test',
    },
    new FakePropertyStore(),
    reportFactory,
  );

  client.addRule(genderTargetRule, columns);

  const mockGetReport = vi.spyOn(client, 'getReport');

  let values: Values = {};

  const obj = {
    criterionId: 'gender1',
    customerId: '1',
    customerName: 'Customer 1',
    campaignId: 'C1',
    adGroupId: 'AG1',
    gender: 'MALE',
  };

  for (const { gender } of overrides.values()) {
    mockGetReport.mockImplementation((reportClass) => {
      queryEquals(reportClass, GENDER_TARGET_REPORT);
      const report = client.reportFactory.create(reportClass);
      const mockReportFetch = vi.spyOn(report, 'fetch');
      obj.gender = gender;
      mockReportFetch.mockReturnValue({ AG1: obj });
      return report;
    });
    const { results, rules } = await client.validate();
    writeBackToColumns(rules, columns);
    values = results['Gender Target Change']?.values || {};
    expect(mockGetReport).toHaveBeenCalled();
  }
  return values;
}

function queryEquals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query1: ReportClass<any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query2: ReportClass<any, any>,
) {
  expect(query1.query.queryParams).to.equal(query2.query.queryParams);
  expect(query1.query.queryFrom).to.equal(query2.query.queryFrom);
}
