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

// g3-format-prettier

import {AppsScriptPropertyStore} from 'common/sheet_helpers';
import {mockAppsScript} from 'common/test_helpers/mock_apps_script';
import * as api from 'sa360/src/api';

import {MatchTable} from './match_table';

describe('SA360 report aggregation', () => {
  let router: MatchTable;
  beforeEach(() => {
    mockAppsScript();
    router = new MatchTable();
    Utilities.formatDate = (date) => date.toISOString().split('T')[0];
    spyOn(Utilities, 'formatDate').and.callFake(
      (date) => date.toISOString().split('T')[0],
    );
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2020-01-01'));
  });

  afterEach(() => {
    (
      AppsScriptPropertyStore as unknown as {
        cache: Record<string, string>;
      }
    ).cache = {};
    jasmine.clock().uninstall();
  });

  it('correctly maps values from a campaign report', async () => {
    const report = await api.CampaignReport.buildReport({agencyId: '1'});

    expect(report.report['campaignId1']).toEqual(
      jasmine.objectContaining({
        'campaign': 'campaign1',
        'campaignStatus': 'campaignStatus1',
      }),
    );
    expect(report.report['campaignId2']).toEqual(
      jasmine.objectContaining({
        'campaign': 'campaign2',
        'campaignStatus': 'campaignStatus2',
      }),
    );
  });

  it('correctly maps values from an ad group report', async () => {
    const report = await api.AdGroupReport.buildReport({agencyId: '1'});

    expect(report.report['adGroupId1']).toEqual(
      jasmine.objectContaining({
        'adGroup': 'adGroup1',
        'adGroupStatus': 'adGroupStatus1',
      }),
    );
    expect(report.report['adGroupId2']).toEqual(
      jasmine.objectContaining({
        'adGroup': 'adGroup2',
        'adGroupStatus': 'adGroupStatus2',
      }),
    );
  });

  it('correctly maps values from an ad group target report', async () => {
    const report = await api.AdGroupTargetReport.buildReport({agencyId: '1'});

    expect(report.report['adGroupId1']).toEqual(
      jasmine.objectContaining({
        'adGroupId': 'adGroupId1',
        'ageTargetAgeRange': 'ageTargetAgeRange1',
        'engineRemarketingList': 'engineRemarketingList1',
      }),
    );
  });

  it('correctly appends values from an ad group target report with multiple targets', async () => {
    const report = await api.AdGroupTargetReport.buildReport({agencyId: '2'});

    expect(report.report['adGroupId1']).toEqual(
      jasmine.objectContaining({
        'adGroupId': 'adGroupId1',
        'ageTargetAgeRange': 'ageTargetAgeRange1,ageTargetAgeRange2',
        'engineRemarketingList':
          'engineRemarketingList1,engineRemarketingList2',
      }),
    );
    expect(router.getHits().reportGetHits).toEqual(2);
  });

  it('correctly maps values from a campaign target report', async () => {
    const report = await api.CampaignTargetReport.buildReport({agencyId: '1'});
    expect(report.report['campaignId1']).toEqual({
      agency: 'agency1',
      agencyId: 'agencyId1',
      advertiser: 'advertiser1',
      advertiserId: 'advertiserId1',
      campaignId: 'campaignId1',
      locationTargetName: 'locationTargetName1',
    });
  });

  it('concatenates range-bound calls correctly', async () => {
    const oldStep = api.ReportBuilder.step;
    api.ReportBuilder.step = 100;
    const report = await api.AdGroupTargetReport.buildReport({agencyId: '2'});
    expect(report.report['adGroupId1']).toEqual(
      jasmine.objectContaining({
        'ageTargetAgeRange': 'ageTargetAgeRange1,ageTargetAgeRange2',
      }),
    );
    expect(router.getHits().reportGetHits).toEqual(9);
    api.ReportBuilder.step = oldStep;
  });

  it('supports adding from mutateRow', async () => {
    const reportBuilder = new api.CampaignTargetReportBuilder({agencyId: '1'});
    const obj: Record<
      string,
      api.ReportRecord<typeof api.campaignTargetColumns>
    > = {};
    (
      reportBuilder as unknown as {
        mutateRow: (
          obj: {
            [p: string]: api.ReportRecord<typeof api.campaignTargetColumns>;
          },
          id: string,
          headers: string[],
          columns: string[],
        ) => void;
      }
    ).mutateRow(
      obj,
      'id',
      [
        'agency',
        'agencyId',
        'advertiser',
        'advertiserId',
        'campaignId',
        'locationTargetName',
      ],
      ['Agency 1', 'AY1', 'Advertiser 1', 'AV1', '1', 'US'],
    );
    expect(obj).toEqual({
      'id': {
        agency: 'Agency 1',
        agencyId: 'AY1',
        advertiser: 'Advertiser 1',
        advertiserId: 'AV1',
        campaignId: '1',
        locationTargetName: 'US',
      },
    });
  });

  it('saves the last report pull in cache', async () => {
    const originalPull = CacheService.getScriptCache().get('scriptPull');
    await api.AdGroupTargetReport.buildReport({agencyId: '2'});
    const newPull = CacheService.getScriptCache().get('scriptPull');
    expect(originalPull).not.toEqual(newPull);
    expect(newPull).toEqual(String(new Date('2020-01-01').getTime()));
  });
});

describe('Build an AdGroupTargetReport with aggregation', () => {
  it('builds', () => {
    const builder = new TestableAdGroupTargetReportBuilder({
      agencyId: 'AY1',
      advertiserId: 'AV1',
    });
    const obj: Record<
      string,
      api.ReportRecord<typeof api.adGroupTargetColumns>
    > = {};

    builder.mutateRow(
      obj,
      'A1',
      ['ageTargetAgeRange', 'genderTargetGenderType'],
      ['A', ''],
    );
    builder.mutateRow(
      obj,
      'A1',
      ['ageTargetAgeRange', 'genderTargetGenderType'],
      ['', 'B'],
    );

    expect(obj).toEqual({
      'A1': {ageTargetAgeRange: 'A', genderTargetGenderType: 'B'},
    } as unknown as Record<
      string,
      api.ReportRecord<typeof api.adGroupTargetColumns>
    >);
  });
});

class TestableAdGroupTargetReportBuilder extends api.AdGroupTargetReportBuilder {
  override mutateRow(
    obj: {[p: string]: api.ReportRecord<typeof api.adGroupTargetColumns>},
    id: string,
    headers: string[],
    columns: string[],
  ) {
    // exposing a protected class as public
    return super.mutateRow(obj, id, headers, columns);
  }
}
