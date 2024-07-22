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

import { PropertyStore } from 'common/types';
import {
  adGroupColumns,
  AdGroupReport,
  adGroupTargetColumns,
  AdGroupTargetReport,
  campaignColumns,
  CampaignReport,
  campaignTargetColumns,
  CampaignTargetReport,
} from 'sa360/src/api';
import { ClientArgs } from 'sa360/src/types';

import { ColumnType } from '../api';
import { Client } from '../client';

interface TestDataParams {
  advertiserId: string;
  columns?: string[][];
  campaignId?: string;
}

/**
 * Contains properties we care about from geo.
 */
export interface GeoTargetTestDataParams extends TestDataParams {
  geoTargets?: string[];
  excludes?: string[];
}

/**
 * Contains properties we care about from an insertion order.
 */
export interface InsertionOrderTestDataParams extends TestDataParams {
  fakeSpendAmount?: number;
}

/**
 * Fake ad group target report
 */
export class FakeAdGroupTargetReport extends AdGroupTargetReport {
  static buildTestReport(report: {
    [adGroupId: string]: Record<
      ColumnType<typeof adGroupTargetColumns>,
      string
    >;
  }) {
    // tslint:disable-next-line:no-any
    return new AdGroupTargetReport(report);
  }
}

/**
 * Fake ad group report
 */
export class FakeAdGroupReport extends AdGroupReport {
  static buildTestReport(report: {
    [adGroupId: string]: Record<ColumnType<typeof adGroupColumns>, string>;
  }) {
    // tslint:disable-next-line:no-any
    return new AdGroupReport(report);
  }
}

/**
 * Fake campaign report
 */
export class FakeCampaignReport extends CampaignReport {
  static buildTestReport(report: {
    [campaignId: string]: Record<ColumnType<typeof campaignColumns>, string>;
  }) {
    // tslint:disable-next-line:no-any
    return new CampaignReport(report);
  }
}

/**
 * Fake campaign target report
 */
export class FakeCampaignTargetReport extends CampaignTargetReport {
  static buildTestReport(report: {
    [campaignId: string]: Record<
      ColumnType<typeof campaignTargetColumns>,
      string
    >;
  }) {
    // tslint:disable-next-line:no-any
    return new CampaignTargetReport(report);
  }
}

/**
 * A faked client with stubbed endpoints.
 */
export class FakeClient extends Client {
  constructor(
    properties: PropertyStore,
    args: ClientArgs = { advertiserId: 'AV1', agencyId: 'AY1', label: 'Fake' },
  ) {
    super(
      {
        advertiserId: args.advertiserId || 'AV1',
        agencyId: args.agencyId || 'AY1',
        label: args.label || 'Fake',
      },
      properties,
    );
  }

  override async getAdGroupTargetReport() {
    return FakeAdGroupTargetReport.buildTestReport({});
  }

  override async getAdGroupReport() {
    return FakeAdGroupReport.buildTestReport({});
  }

  override async getCampaignReport() {
    return FakeCampaignReport.buildTestReport({});
  }

  override async getCampaignTargetReport() {
    return FakeCampaignTargetReport.buildTestReport({});
  }
}
