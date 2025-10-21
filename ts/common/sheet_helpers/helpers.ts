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

import { GCP_PROJECT_RANGE } from './constants';

const SCRIPT_PULL = 'scriptPull';

/**
 * Helpers that can be stubbed in tests for migrations.
 */
export const HELPERS = {
  insertRows(range: GoogleAppsScript.Spreadsheet.Range) {
    range.insertCells(SpreadsheetApp.Dimension.ROWS);
  },
  applyAnomalyHelper(
    range: GoogleAppsScript.Spreadsheet.Range,
    column: number = 4,
  ) {
    const filter = range.getFilter();
    // A filter can only be added once to a sheet
    if (!filter) {
      const criteria =
        SpreadsheetApp.newFilterCriteria().whenTextEqualTo('TRUE');
      range.createFilter().setColumnFilterCriteria(column, criteria.build());
    }
  },
  saveLastReportPull(time: number) {
    CacheService.getScriptCache().put(SCRIPT_PULL, time.toString());
  },
  getLastReportPull(): number {
    return Number(CacheService.getScriptCache().get(SCRIPT_PULL));
  },
  getSheetId() {
    return SpreadsheetApp.getActive().getId();
  },
  /**
   * Retrieve data from BigQuery if BigQuery is enabled. Otherwise, throws an error.
   *
   * @param query A GoogleSQL query
   * @returns An array of objects where each object is keyed to the query's column labels.
   */
  bigQueryGet(query: string): Array<Record<string, unknown>> {
    const projectId = this.getValueFromRangeByName({
      name: GCP_PROJECT_RANGE,
      allowEmpty: false,
    }) as string;
    const result = BigQuery.Jobs.query(
      {
        query,
        useLegacySql: false,
      },
      projectId,
    );
    const headers = result.schema.fields.map((h) => h.name);
    const rows = result.rows.map((row) =>
      Object.fromEntries(row.f.map((column, i) => [headers[i], column.v])),
    );
    return rows;
  },
  isBigQueryEnabled() {
    return Boolean(
      this.getValueFromRangeByName({
        name: GCP_PROJECT_RANGE,
        allowEmpty: true,
      }),
    );
  },

  /**
   * Realistically-typed value getter from a named range.
   */
  getValueFromRangeByName<AllowEmpty extends boolean>(args: {
    name: string;
    allowEmpty: AllowEmpty;
  }): AllowEmpty extends true ? string | number | undefined : string | number {
    const range = this.getRangeByName(args.name);
    const value = range.getValue();
    if (!value && !args.allowEmpty) {
      throw new Error(`Require a value in named range '${args.name}'`);
    }

    return value || undefined;
  },

  getRangeByName(name: string) {
    const range = SpreadsheetApp.getActive().getRangeByName(name);
    if (!range) {
      throw new Error(
        `Missing an expected range '${name}'. You may need to get a new version of this sheet from the template.`,
      );
    }

    return range;
  },
  getOrCreateSheet(sheetName: string) {
    const active = SpreadsheetApp.getActive();
    return active.getSheetByName(sheetName) || active.insertSheet(sheetName);
  },

  getDriveFolderId(): string {
    const active = SpreadsheetApp.getActive();
    // Try new way first
    try {
      const settingsRange = active.getRangeByName('SETTINGS');
      if (settingsRange && settingsRange.getValue()) {
        const settings = JSON.parse(settingsRange.getValue());
        if (settings.driveFolderId) {
          return settings.driveFolderId;
        }
      }
    } catch (_e) {
      // Fall through to legacy
    }

    // Fallback to legacy named range
    try {
      const driveIdRange = active.getRangeByName('DRIVE_ID');
      if (driveIdRange && driveIdRange.getValue()) {
        return driveIdRange.getValue().trim();
      }
    } catch (_e) {
      // Fall through to error
    }

    throw new Error(
      'Missing Google Drive Folder ID. Please check the "SETTINGS" or "DRIVE_ID" named range in the General/Settings sheet.',
    );
  },
};

/**
 * Retrieves a named range, if it exists. Otherwise, it throws an error.
 */
export function getTemplateSetting(
  rangeName: string,
): GoogleAppsScript.Spreadsheet.Range {
  const range = SpreadsheetApp.getActive().getRangeByName(rangeName);
  if (!range) {
    throw new Error(
      `The sheet has an error. A named range '${rangeName}' that should exist does not.`,
    );
  }

  return range;
}
