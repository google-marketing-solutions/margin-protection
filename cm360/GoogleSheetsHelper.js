/***************************************************************************
 *
 *  Copyright 2023 Google Inc.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 *  Note that these code samples being shared are not official Google
 *  products and are not formally supported.
 *
 ***************************************************************************/

/**
 * @fileoverview This file provides a set of utility functions for interacting
 * with Google Sheets. These functions handle tasks like writing data, creating
 * and formatting sheets, clearing ranges, and applying conditional formatting.
 */

/**
 * Writes data to a sheet, clears previous content, and applies formatting.
 *
 * @param {string} sheetName The name of the target sheet.
 * @param {string} tabColor The hex color code for the sheet tab.
 * @param {number} startRow The starting row index for writing data.
 * @param {number} startColumn The starting column index for writing data.
 * @param {number} columnToResize The starting column index to auto-resize.
 * @param {number} numColsToResize The number of columns to auto-resize.
 * @param {!Array<!Array<string>>} data The 2D array of data to write.
 */
function addDataToSheet(
  sheetName,
  tabColor,
  startRow,
  startColumn,
  columnToResize,
  numColsToResize,
  data,
) {
  if (data.length === 0) {
    Logger.log(`addDataToSheet: There is no data for sheet ${sheetName}.`);
    return;
  }
  insertSheet(sheetName);
  clearSheetRange(sheetName, startRow, startColumn);
  writeData(sheetName, startRow, startColumn, data);
  formatSheet(sheetName, tabColor, columnToResize, numColsToResize);
  formatTableInSheet(sheetName, tabColor, data);
}

/**
 * Writes a 2D array of data to a specified sheet and range.
 *
 * @param {string} sheetName The name of the target sheet.
 * @param {number} startRow The starting row index.
 * @param {number} startColumn The starting column index.
 * @param {!Array<!Array<string>>} data The 2D array of data to write.
 */
function writeData(sheetName, startRow, startColumn, data) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  sheet
    .getRange(startRow, startColumn, data.length, data[0].length)
    .setValues(data);
}

/**
 * Clears all content from a sheet starting at a specified cell.
 *
 * @param {string} sheetName The name of the sheet to clear.
 * @param {number} startRow The starting row index to begin clearing.
 * @param {number} startColumn The starting column index to begin clearing.
 */
function clearSheetRange(sheetName, startRow, startColumn) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  sheet
    .getRange(
      startRow,
      startColumn,
      sheet.getDataRange().getLastRow(),
      sheet.getDataRange().getLastColumn(),
    )
    .clear();
}

/**
 * Inserts a new sheet with the specified name if it does not already exist.
 *
 * @param {string} sheetName The name of the sheet to insert.
 */
function insertSheet(sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  // Add sheet if not found
  if (!sheet) {
    let numSheets = spreadsheet.getSheets().length;
    spreadsheet.insertSheet(sheetName, numSheets + 1);
  }
}

/**
 * Adds conditional formatting rules to a sheet based on text values.
 *
 * @param {string} sheetName The name of the target sheet.
 * @param {string} rangeToFormat The range in A1 notation to apply formatting.
 * @param {!Array<{ruleType: string, color: string}>} alertRules An array of
 *     objects, each defining a text value and a background color.
 */
function addConditionalFormattingToSheet(sheetName, rangeToFormat, alertRules) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  const range = sheet.getRange(rangeToFormat);
  let rules = sheet.getConditionalFormatRules();
  // Rules might have different color codes
  alertRules.forEach((r) => {
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(r['ruleType'])
      .setBackground(r['color'])
      .setRanges([range])
      .build();
    rules.push(rule);
  });
  sheet.setConditionalFormatRules(rules);
}

/**
 * Applies basic formatting to a sheet, such as freezing rows and setting tab
 * color.
 *
 * @param {string} sheetName The name of the target sheet.
 * @param {string} tabColor The hex color code for the sheet tab.
 * @param {?number} columnToResize The starting column to auto-resize.
 * @param {?number} numColsToResize The number of columns to auto-resize.
 */
function formatSheet(sheetName, tabColor, columnToResize, numColsToResize) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  sheet.setFrozenRows(1);
  sheet.setTabColor(tabColor);
  if (columnToResize && numColsToResize) {
    sheet.autoResizeColumns(columnToResize, numColsToResize);
  }
}

/**
 * Formats a data table within a sheet, including header styling and row
 * banding.
 *
 * @param {string} sheetName The name of the target sheet.
 * @param {string} headersColor The hex color code for the header background.
 * @param {!Array<!Array<string>>} data The 2D data array, used to determine
 *     range.
 */
function formatTableInSheet(sheetName, headersColor, data) {
  const headers = data[0];
  // Format headers and data
  let sheet = spreadsheet.getSheetByName(sheetName);
  let headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(headersColor);
  headerRange.setFontColor('white');
  headerRange.setFontWeight('bold');
  let dataRange = sheet.getRange(2, 1, data.length, data[0].length);
  let bandings = sheet.getBandings();
  if (bandings && bandings.length === 0) {
    dataRange.applyRowBanding(
      SpreadsheetApp.BandingTheme.LIGHT_GREY,
      false,
      false,
    );
  }
}

/**
 * Sorts a data range in a sheet by one or more columns in ascending order.
 *
 * @param {string} sheetName The name of the target sheet.
 * @param {string} rangeToSort The range to sort in A1 notation.
 * @param {!Array<number>} sortByColumns An array of column indexes to sort by.
 */
function shortTableByColumns(sheetName, rangeToSort, sortByColumns) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  let dataRange = sheet.getRange(rangeToSort);
  if (sortByColumns && sortByColumns.length > 0) {
    dataRange.sort(sortByColumns);
  }
}

/**
 * Creates a filter for a data range if one does not already exist.
 *
 * @param {string} sheetName The name of the target sheet.
 * @param {string} rangeToFilter The range to apply the filter to in A1
 *     notation.
 */
function createFilterForTable(sheetName, rangeToFilter) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  let dataRange = sheet.getRange(rangeToFilter);
  const filter = dataRange.getFilter();
  // A filter can only be added once to a sheet
  if (!filter) {
    dataRange.createFilter();
  }
}
