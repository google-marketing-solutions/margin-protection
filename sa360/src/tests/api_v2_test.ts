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
 * @fileoverview Tests for the SA360 API V2.
 */

// g3-format-prettier

import 'jasmine';

import {
  CredentialManager,
  GoogleAdsApi,
  GoogleAdsApiFactory,
  Report,
  ReportFactory,
  SA360_API_ENDPOINT,
} from 'common/ads_api';
import {
  QueryBuilder,
  ReportResponse,
  buildQuery,
} from 'common/ads_api_types';
import {
  AD_GROUP_REPORT,
  CAMPAIGN_REPORT,
} from 'sa360/src/api_v2';

describe('ApiV2', () => {
  let mockQuery: jasmine.Spy;
  let apiFactory: GoogleAdsApiFactory;
  let api: GoogleAdsApi;
  let reportFactory: ReportFactory;

  beforeEach(() => {
    apiFactory = new GoogleAdsApiFactory({
      developerToken: '',
      credentialManager: new CredentialManager(),
      apiEndpoint: SA360_API_ENDPOINT,
    });
    api = apiFactory.create('');
    spyOn(apiFactory, 'create').and.returnValue(api);
    reportFactory = new ReportFactory(apiFactory, {
      customerIds: '1',
      label: 'test',
    });
    spyOn(reportFactory, 'create').and.callFake((reportClass) =>
      new ReportFactory(apiFactory, {
        customerIds: '1',
        label: 'test',
      }).create(reportClass),
    );
  });

  it('returns expected results from query', () => {
    mockQuery = spyOn(api, 'query');
    mockQuery.and.returnValue(
      iterator({
        some: {one: 'one'},
        other: {two: 'two'},
        final: {three: 'three'},
      }),
    );
    const report = reportFactory.create(FakeReport);
    expect(report.fetch()).toEqual({
      one: {one: 'one', two: 'two', three: 'three'},
    });
  });

  describe('Campaign report', () => {
    it('returns expected results', () => {
      const mockQuery: jasmine.Spy = spyOn(api, 'query');
      mockQuery.and.returnValue(
        iterator(
          ...[...Array.from({length: 5}).keys()].map((x: number) => ({
            customer: {
              resourceName: 'customers/1',
              name: 'Customer 1',
              id: '1',
            },
            campaign: {
              resourceName: `customers/1/campaigns/c${x}`,
              id: `c${x}`,
              status:
                x % 2 === 0 ? 'ENABLED' : x % 3 === 0 ? 'REMOVED' : 'PAUSED',
              name: `Campaign ${x}`,
            },
          })),
        ),
      );
      const report = reportFactory.create(CAMPAIGN_REPORT);
      expect(report.fetch()).toEqual({
        'c0': {
          customerId: '1',
          customerName: 'Customer 1',
          campaignId: 'c0',
          campaignName: 'Campaign 0',
          campaignStatus: 'ENABLED',
        },
        'c1': {
          customerId: '1',
          customerName: 'Customer 1',
          campaignId: 'c1',
          campaignName: 'Campaign 1',
          campaignStatus: 'PAUSED',
        },
        'c2': {
          customerId: '1',
          customerName: 'Customer 1',
          campaignId: 'c2',
          campaignName: 'Campaign 2',
          campaignStatus: 'ENABLED',
        },
        'c3': {
          customerId: '1',
          customerName: 'Customer 1',
          campaignId: 'c3',
          campaignName: 'Campaign 3',
          campaignStatus: 'REMOVED',
        },
        'c4': {
          customerId: '1',
          customerName: 'Customer 1',
          campaignId: 'c4',
          campaignName: 'Campaign 4',
          campaignStatus: 'ENABLED',
        },
      });
    });
  });

  describe('Ad Group report', () => {
    it('returns expected results', () => {
      const mockQuery: jasmine.Spy = spyOn(api, 'query');
      mockQuery.and.returnValue(
        iterator(
          ...[...Array.from({length: 5}).keys()].map((x) => ({
            customer: {
              resourceName: 'customers/1',
              name: 'Customer 1',
              id: '1',
            },
            campaign: {
              resourceName: `customers/1/campaigns/c${Math.floor(x / 2)}`,
              id: `c${Math.floor(x / 2)}`,
            },
            adGroup: {
              resourceName: `customers/1/adGroups/ag${x}`,
              id: `ag${x}`,
              status: x < 3 ? 'ACTIVE' : 'PAUSED',
              name: `AdGroup ${x}`,
            },
          })),
        ),
      );
      const report = reportFactory.create(AD_GROUP_REPORT);
      expect(report.fetch()).toEqual({
        'ag0': {
          customerId: '1',
          customerName: 'Customer 1',
          campaignId: 'c0',
          adGroupId: 'ag0',
          adGroupName: 'AdGroup 0',
          adGroupStatus: 'ACTIVE',
        },
        'ag1': {
          customerId: '1',
          customerName: 'Customer 1',
          campaignId: 'c0',
          adGroupId: 'ag1',
          adGroupName: 'AdGroup 1',
          adGroupStatus: 'ACTIVE',
        },
        'ag2': {
          customerId: '1',
          customerName: 'Customer 1',
          campaignId: 'c1',
          adGroupId: 'ag2',
          adGroupName: 'AdGroup 2',
          adGroupStatus: 'ACTIVE',
        },
        'ag3': {
          customerId: '1',
          customerName: 'Customer 1',
          campaignId: 'c1',
          adGroupId: 'ag3',
          adGroupName: 'AdGroup 3',
          adGroupStatus: 'PAUSED',
        },
        'ag4': {
          customerId: '1',
          customerName: 'Customer 1',
          campaignId: 'c2',
          adGroupId: 'ag4',
          adGroupName: 'AdGroup 4',
          adGroupStatus: 'PAUSED',
        },
      });
    });
  });
});

const FAKE_QUERY: QueryBuilder<
  'some.one' | 'other.two' | 'final.three',
  undefined
> = buildQuery({
  queryParams: ['some.one', 'other.two', 'final.three'],
  queryFrom: 'somewhere',
});

class FakeReport extends Report<typeof FAKE_QUERY, 'one' | 'two' | 'three'> {
  static output = ['one', 'two', 'three'];
  static query = FAKE_QUERY;
  transform(result: ReportResponse<typeof FAKE_QUERY>) {
    return [
      result.some.one as string,
      {
        one: result.some.one as string,
        two: result.other.two as string,
        three: result.final.three as string,
      },
    ] as const;
  }
}

function iterator<T>(...a: T[]): IterableIterator<T> {
  return a[Symbol.iterator]();
}

/**
 * Stub for granularity
 */
export enum Granularity {
  DEFAULT = 'default',
}
