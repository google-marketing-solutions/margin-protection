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
 * Writes data to a sheet and formats the sheet and data.
 *
 *  @param {string} sheetName - The name of the tab where the data will be added.
 *  @param {string} tabColor - The color for the tab.
 *  @param {int} startRow - The row where the data will be added.
 *  @param {int} startColumn - The column where the data will be added.
 *  @param {int} columnToResize - The starting column to auto-resize.
 *  @param {int} numColsToResize - The number of columns to auto-resize.
 *  @param {list[list]} data - The data to be added to the sheet.
 *
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
 * Writes the specified data to the specified sheet.
 *
 *  @param {string} sheetName - The name of the tab where the data will be added.
 *  @param {int} startRow - The row where the data will be added.
 *  @param {int} startColumn - The column where the data will be added.
 *  @param {list[list]} data - The data to be added to the sheet.
 */
function writeData(sheetName, startRow, startColumn, data) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  sheet
    .getRange(startRow, startColumn, data.length, data[0].length)
    .setValues(data);
}

/**
 * Clears the sheet range.
 *
 *  @param {string} sheetName - The name of the tab where the data will be added.
 *  @param {int} startRow - The row where the data will be added.
 *  @param {int} startColumn - The column where the data will be added.
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
 * Inserts a new sheet with the specified name if it does not exist.
 *
 * @param {string} sheetName - The name of the tab where the data will be added.
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
 * Adds conditional formatting to a sheet using the TextEqualTo function.
 *
 *  @param {string} sheetName - The name of the tab where the data will be added.
 *  @param {string} rangeToFormat - The range to format in A1 notation.
 *  @param {string} flagValue - The value that the condition has to meet to add apply the format.
 *  @param {string} color - The color to be applied if the condition is met.
 *
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
 * Formats the sheet by adding colors and frozer rows
 *
 *  @param {string} sheetName - The name of the tab where the data will be added.
 *  @param {string} tabColor - The color for the tab.
 *  @param {int} columnToResize - The starting column to auto-resize.
 *  @param {int} numColsToResize - The number of columns to auto-resize.
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
 * Formats the data in the sheet by header colors and row banding
 *
 *  @param {string} sheetName - The name of the tab where the data will be added.
 *  @param {string} headersColor - The color of the header.
 *  @param {list[list]} data - The data to be added to the sheet.
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
 * Sorts the data table by the specified list of columns
 * Ascending order by default
 *
 *  @param {string} sheetName - The name of the tab where the data will be added.
 *  @param {list} sortByColumns - A list of columns to sort by
 *  @param {string} rangeToSort - The range in the table to sort
 */
function shortTableByColumns(sheetName, rangeToSort, sortByColumns) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  let dataRange = sheet.getRange(rangeToSort);
  if (sortByColumns && sortByColumns.length > 0) {
    dataRange.sort(sortByColumns);
  }
}

/**
 * Creates a filter in the table containing the report data
 *
 *  @param {string} sheetName - The name of the tab where the data will be added.
 *  @param {string} rangeToSort - The range in the table to create the filter on
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
