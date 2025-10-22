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

import { mockAppsScript } from '../../test_helpers/mock_apps_script.js';
import { HELPERS } from '../helpers.js';
import { scaffoldSheetWithNamedRanges } from '../../tests/helpers.js';
import { describe, beforeEach, it, expect } from 'vitest';

describe('HELPERS', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  it('saveLastReportPull', function () {
    HELPERS.saveLastReportPull(1);
    expect(CacheService.getScriptCache().get('scriptPull')).to.equal('1');
    const expirationInSeconds = (
      CacheService.getScriptCache() as unknown as {
        expirationInSeconds: number | undefined;
      }
    ).expirationInSeconds;
    expect(expirationInSeconds).to.be.undefined;
  });

  it('getLastReportPull', function () {
    CacheService.getScriptCache().put('scriptPull', '10');
    expect(HELPERS.getLastReportPull()).to.equal(10);
  });
});

describe('BigQuery interop', function () {
  beforeEach(function () {
    mockAppsScript();
  });

  it('converts a BigQuery object into the desired output', function () {
    scaffoldSheetWithNamedRanges();
    globalThis.BigQuery.Jobs.query = () => ({
      kind: 'bigquery#queryResponse',
      schema: {
        fields: [
          {
            name: 'criteria_id',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'en_name',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'canonical_name',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'parent_id',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'country_code',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'display_feature_type',
            type: 'STRING',
            mode: 'NULLABLE',
          },
          {
            name: 'status',
            type: 'STRING',
            mode: 'NULLABLE',
          },
        ],
      },
      jobReference: {
        projectId: 'project',
        jobId: 'job_1',
        location: 'US',
      },
      totalRows: '3',
      rows: [
        {
          f: [
            {
              v: 'ID 1' as unknown as object,
            },
            {
              v: 'English Name 1' as unknown as object,
            },
            {
              v: 'Canonical Name 1' as unknown as object,
            },
            {
              v: 'Parent ID 1' as unknown as object,
            },
            {
              v: 'Country Code 1' as unknown as object,
            },
            {
              v: 'Display Feature Type 1' as unknown as object,
            },
            {
              v: 'Status 1' as unknown as object,
            },
          ],
        },
        {
          f: [
            {
              v: 'ID 2' as unknown as object,
            },
            {
              v: 'English Name 2' as unknown as object,
            },
            {
              v: 'Canonical Name 2' as unknown as object,
            },
            {
              v: 'Parent ID 2' as unknown as object,
            },
            {
              v: 'Country Code 2' as unknown as object,
            },
            {
              v: 'Display Feature Type 2' as unknown as object,
            },
            {
              v: 'Status 2' as unknown as object,
            },
          ],
        },
        {
          f: [
            {
              v: 'ID 3' as unknown as object,
            },
            {
              v: 'English Name 3' as unknown as object,
            },
            {
              v: 'Canonical Name 3' as unknown as object,
            },
            {
              v: 'Parent ID 3' as unknown as object,
            },
            {
              v: 'Country Code 3' as unknown as object,
            },
            {
              v: 'Display Feature Type 3' as unknown as object,
            },
            {
              v: 'Status 3' as unknown as object,
            },
          ],
        },
      ],
      totalBytesProcessed: '1',
      jobComplete: true,
      cacheHit: false,
      queryId: 'job_1',
      jobCreationReason: {
        code: 'REQUESTED',
      },
    });

    const result = HELPERS.bigQueryGet('stub');

    expect(result).toEqual(
      [1, 2, 3].map((i) => ({
        criteria_id: `ID ${i}`,
        en_name: `English Name ${i}`,
        canonical_name: `Canonical Name ${i}`,
        parent_id: `Parent ID ${i}`,
        country_code: `Country Code ${i}`,
        display_feature_type: `Display Feature Type ${i}`,
        status: `Status ${i}`,
      })),
    );
  });

  it('fails with no GCP project ID set', function () {
    mockAppsScript();
    scaffoldSheetWithNamedRanges({ blanks: ['GCP_PROJECT_ID'] });
    expect(() => HELPERS.bigQueryGet('stub')).to.throw(
      "Require a value in named range 'GCP_PROJECT_ID'",
    );
  });
});
