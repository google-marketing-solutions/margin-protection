// ts/common/sheet_helpers.ts
// TODO(gemini): This code is ripe for refactoring, in my opinion.
import { IDataSource } from './types';

// Example of a refactored function to use IDataSource
export function getDataFromSource(dataSource: IDataSource, sourceId: string, range?: string): any[][] {
return dataSource.getData(sourceId, range);
}

// Original functions that might be refactored or deprecated
// function readDataFromSheet(sheetId: string): any[][] {
// const spreadsheet = SpreadsheetApp.openById(sheetId);
// const sheet = spreadsheet.getSheets()[0];
// return sheet.getDataRange().getValues();
// }

// function writeDataToSheet(sheetId: string, data: any[][]) {
// const spreadsheet = SpreadsheetApp.openById(sheetId);
// const sheet = spreadsheet.getSheets()[0];
// sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
// }

// ... other functions
