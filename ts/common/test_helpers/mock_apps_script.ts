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
 * @fileoverview Mocked classes for Apps Script to help with unit tests.
 */

import {PropertyStore} from 'common/types';

import BigQuery = GoogleAppsScript.BigQuery;
import Properties = GoogleAppsScript.Properties;
import Cache = GoogleAppsScript.Cache;
import Mail = GoogleAppsScript.Mail;

function a1NotationToRowColumn(a1Notation: string, start = true) {
  const a = 'A'.charCodeAt(0);
  let column = 0;
  let i: number;
  const parts = a1Notation.toUpperCase().match(/([A-Z]+)([1-9]\d*)?/);
  if (!parts) {
    throw new Error('Invalid A1 notation');
  }
  const letters = parts[1];
  const row: number = parts[2]
    ? Number.parseInt(parts[2], 10)
    : start
      ? 1
      : 100_000;
  for (i = 0; i < letters.length; i++) {
    column += letters.charCodeAt(i) - a + 1;
  }

  return {row, column};
}

class FakeRange {
  private readonly arrayRange: string[][];
  validation: FakeNewDataValidation;

  constructor(
    private readonly sheet: FakeSheet,
    private readonly row: number,
    private readonly column: number,
    private readonly numRows = 1,
    private readonly numColumns = 1,
  ) {
    this.arrayRange = this.initializeSheet();
  }

  private getRangeComponent() {
    return this.sheet.cells.slice(this.row - 1, this.row - 1 + this.numRows);
  }

  initializeSheet() {
    return this.getRangeComponent().map((columns) =>
      columns
        .slice(this.column - 1, this.column - 1 + this.numColumns)
        .map((cell) => cell ?? ''),
    );
  }
  static byA1Notation(sheet: FakeSheet, a1Notation: string) {
    const parts = a1Notation.split(':');
    const {row: row1, column: column1} = a1NotationToRowColumn(parts[0], true);
    const {row: row2, column: column2} = a1NotationToRowColumn(
      parts[1] || parts[0],
      false,
    );
    return new FakeRange(
      sheet,
      row1,
      column1,
      row2 - row1 + 1,
      column2 - column1 + 1,
    );
  }

  getValues() {
    return this.arrayRange;
  }

  getValue() {
    return this.arrayRange[0][0];
  }

  setValues(range: string[][]) {
    if (this.numRows !== range.length) {
      throw new Error(
        `Invalid row length: ${this.arrayRange.length} vs ${range.length}`,
      );
    }
    for (const [i, row] of range.entries()) {
      if (row.length === this.numColumns) {
        this.arrayRange[i] = row;
      } else {
        throw new Error('Invalid column length');
      }
    }
    this.sheet.cells.splice(
      this.row - 1,
      this.arrayRange.length,
      ...this.arrayRange.map((row) => {
        const newArr = [
          ...row,
          ...Array.from<string>({
            length: this.sheet.cells[0].length - row.length,
          }).fill(''),
        ];
        return newArr;
      }),
    );
    return this;
  }

  setValue(value: string) {
    this.arrayRange[0][0] = value;
    this.sheet.cells[this.row][this.column] = value;
    return this;
  }

  clearDataValidations(): FakeRange {
    return this;
  }

  setDataValidation(validation: FakeNewDataValidation) {
    this.validation = validation;
    return this;
  }

  breakApart() {
    return this;
  }

  merge() {
    return this;
  }

  applyRowBanding() {
    return this;
  }

  insertCells() {
    return this;
  }

  setRichTextValue() {
    return this;
  }

  getFilter() {
    return new FakeFilter();
  }

  insertCheckboxes() {
    for (let r = this.row; r < this.row + this.numRows; r++) {
      for (let c = this.column; c < this.column + this.numColumns; c++) {
        if (!this.sheet.checkboxes[r]) {
          this.sheet.checkboxes[r] = {};
        }
        this.sheet.checkboxes[r][c] = true;
      }
    }
  }
}

class FakeSheet {
  readonly cells: string[][] = Array.from({length: 100}).map(() =>
    Array.from({length: 30}),
  );
  readonly checkboxes: Record<number, Record<number, boolean>> = {};
  private readonly bandings: FakeBandings[] = [];

  getRange(a1Notation: string): FakeRange;
  getRange(row: number, column: number): FakeRange;
  getRange(row: number, column: number, numRows: number): FakeRange;
  getRange(
    row: number,
    column: number,
    numRows: number,
    numColumns: number,
  ): FakeRange;
  getRange(
    arg1: number | string,
    column?: number,
    numRows?: number,
    numColumns?: number,
  ) {
    if (typeof arg1 === 'string') {
      return FakeRange.byA1Notation(this, arg1);
    } else if (!column) {
      throw new Error('Required to include a column');
    }
    return new FakeRange(this, arg1, column, numRows, numColumns);
  }

  getDataRange(): FakeRange {
    return new FakeRange(this, 1, 1, this.getLastRow(), this.getLastColumn());
  }

  getLastColumn() {
    const lastIndexes = this.cells.map((row) =>
      row.findLastIndex((cell) => cell),
    );
    return Math.max(...lastIndexes) + 1;
  }

  clear(): FakeSheet {
    const emptyCells = this.cells.map((row) => row.map(() => ''));
    this.cells.splice(0, this.cells.length, ...emptyCells);
    return this;
  }

  getMaxRows() {
    return 10000;
  }

  getMaxColumns() {
    return 10000;
  }

  getLastRow() {
    return (
      this.cells.findLastIndex((row) => row.filter((cell) => cell).length > 0) +
      1
    );
  }

  deleteRows(start: number, end: number) {
    this.cells.splice(start, end);
  }

  deleteColumns(start: number, end: number) {
    for (const row of this.cells) {
      row.splice(start, end);
    }
  }

  getBandings(): FakeBandings[] {
    return this.bandings;
  }
}

class FakeHtmlService {
  createTemplateFromFile() {
    throw new Error('Not implemented. Stub me.');
  }
}

class FakeSpreadsheet {
  private static lastNum = 1;
  private readonly namedRange: Record<string, FakeRange> = {};
  private readonly sheets: Record<string, FakeSheet> = {
    Sheet1: new FakeSheet(),
  };
  private lastActive = 'Sheet1';

  insertSheet(sheetName: string) {
    const computedSheetName = sheetName || `Sheet${++FakeSpreadsheet.lastNum}`;
    this.sheets[computedSheetName] = new FakeSheet();
    return this.sheets[computedSheetName];
  }

  getRangeByName(rangeName: string) {
    return this.namedRange[rangeName];
  }

  setNamedRange(rangeName: string, range: FakeRange) {
    this.namedRange[rangeName] = range;
  }

  getSheetByName(sheetName: keyof typeof this.sheets) {
    return this.sheets[sheetName];
  }

  getActiveSheet() {
    return this.sheets[this.lastActive];
  }
}

class FakeSpreadsheetApp {
  private readonly fakeSpreadsheet = new FakeSpreadsheet();
  readonly BandingTheme = {
    BLUE: 1,
  };
  readonly Dimension = {
    ROWS: 1,
    COLUMNS: 2,
  };

  getActive() {
    return this.fakeSpreadsheet;
  }

  flush() {
    // do nothing
  }

  newDataValidation() {
    return new FakeNewDataValidation();
  }

  newTextStyle() {
    return new FakeTextStyle();
  }

  newRichTextValue() {
    return new FakeRichTextValue();
  }
}

/**
 * Used to generate mocks for Apps Script libraries that are used in this
 * client.
 */
export function mockAppsScript() {
  (globalThis.MailApp as unknown as FakeMailApp) = new FakeMailApp();
  (globalThis.PropertiesService as unknown as FakePropertiesService) =
    new FakePropertiesService();
  (globalThis.CacheService as unknown as FakeCacheService) =
    new FakeCacheService();
  (globalThis.Utilities as unknown as FakeUtilitiesService) =
    new FakeUtilitiesService();
  (globalThis.SpreadsheetApp as unknown as FakeSpreadsheetApp) =
    new FakeSpreadsheetApp();
  (globalThis.ScriptApp as unknown as FakeScriptApp) = new FakeScriptApp();
  (globalThis.HtmlService as unknown as FakeHtmlService) =
    new FakeHtmlService();
  (globalThis.UrlFetchApp as unknown as FakeUrlFetchApp) =
    new FakeUrlFetchApp();
  (globalThis.Drive as unknown as FakeDrive) = new FakeDrive();
  (globalThis.BigQuery as unknown as FakeBigQuery) = new FakeBigQuery();
}

class FakeUrlFetchApp {
  fetch() {
    throw new Error('Not implemented. Mock me.');
  }
}

/**
 * A return value for a FakeUrlFetchApp
 */
export function generateFakeHttpResponse(args: {contentText: string}) {
  return {
    getContentText() {
      return args.contentText;
    },
  } as unknown as GoogleAppsScript.URL_Fetch.HTTPResponse;
}

class FakeScriptApp {
  getOAuthToken() {
    return 'token';
  }
}

/**
 * Retrieves emails
 */
export function getEmails() {
  return (MailApp as unknown as FakeMailApp).getEmails();
}

class FakeMailApp {
  private readonly emails: Mail.MailAdvancedParameters[] = [];

  sendEmail(message: Mail.MailAdvancedParameters) {
    this.emails.push(message);
  }

  getEmails() {
    return this.emails;
  }
}

class PropertyStub implements Properties.Properties {
  private storage: {[key: string]: string} = {};

  getProperties() {
    return this.storage;
  }

  setProperties(properties: {[key: string]: string}) {
    this.storage = properties;
    return this;
  }

  getProperty(key: string) {
    return this.storage[key];
  }

  setProperty(key: string, value: string) {
    this.storage[key] = value;
    return this;
  }

  deleteProperty(key: string): Properties.Properties {
    delete this.storage[key];
    return this;
  }

  deleteAllProperties(): Properties.Properties {
    this.storage = {};
    return this;
  }

  getKeys(): string[] {
    return Object.keys(this.storage);
  }
}

class CacheStub implements Cache.Cache {
  private cache: Record<string, string> = {};
  expirationInSeconds: number | undefined;

  getAll(): Record<string, string> {
    throw new Error('Method not implemented.');
  }
  putAll(values: Record<string, string>): void;
  putAll(values: Record<string, string>, expirationInSeconds: number): void;
  putAll(values: Record<string, string>, expirationInSeconds?: number): void {
    this.cache = values;
    this.expirationInSeconds = expirationInSeconds;
  }
  remove(key: string): void {
    delete this.cache[key];
  }
  removeAll(keys: string[]): void {
    for (const key of keys) {
      delete this.cache[key];
    }
  }
  put(key: string, value: string, expirationInSeconds?: number): void {
    this.cache[key] = value;
    this.expirationInSeconds = expirationInSeconds;
  }
  get(key: string) {
    return this.cache[key];
  }
}
class FakePropertiesService {
  constructor(private readonly propertyStub = new PropertyStub()) {}

  getScriptProperties() {
    return this.propertyStub;
  }
}

class FakeCacheService {
  constructor(private readonly cacheStub = new CacheStub()) {}

  getScriptCache() {
    return this.cacheStub;
  }
}

class FakeBlob {
  constructor(readonly content: string) {}

  getDataAsString() {
    return this.content;
  }

  getBytes() {
    return `bytes:${this.content}`;
  }
}

class FakeGzip extends FakeBlob {
  constructor(gzipped: FakeBlob) {
    super('gzipped:' + gzipped.content);
  }
}

/**
 * Stubs utilities for testing gzip, blobs, etc.
 */
export class FakeUtilitiesService {
  newBlob(content: string): FakeBlob {
    return new FakeBlob(content.replace(/^bytes:/, ''));
  }

  gzip(content: FakeBlob): FakeGzip {
    return new FakeGzip(content);
  }

  ungzip(blob: FakeGzip | FakeBlob): FakeBlob {
    if (!blob.content.startsWith('gzipped')) {
      throw new Error('Not gzipped');
    }
    const content = blob.content.replace(/^gzipped:/, '');
    return new FakeBlob(content);
  }

  parseCsv(text: string) {
    // We don't need a special package because this test CSV is very
    // basic. No escaping, etc.
    const lines = text.split('\n').map((line: string) => line.split(','));
    return lines;
  }

  base64Encode(text: string) {
    if (!text.startsWith('bytes:')) {
      throw new Error('Not bytes');
    }
    return `encoded:${text.replace(/^bytes:/, '')}`;
  }

  base64Decode(text: string) {
    if (!text.startsWith('encoded')) {
      throw new Error('Not encoded');
    }

    return text.replace(/^encoded:/, 'bytes:');
  }

  sleep(msecs: number) {
    console.info(`skip sleep for ${msecs}`);
  }
}

/**
 * Test-friendly property wrapper lacks Apps Script dependency.
 */
export class FakePropertyStore implements PropertyStore {
  private static cache: Record<string, string> = {};

  setProperty(propertyName: string, value: string): void {
    FakePropertyStore.cache[propertyName] = value;
  }
  getProperty(propertyName: string): string | null {
    return FakePropertyStore.cache[propertyName];
  }

  getProperties() {
    return FakePropertyStore.cache;
  }

  static clearCache() {
    FakePropertyStore.cache = {};
  }
}

/**
 * Stub for HTML output
 */
export class FakeHtmlOutput {}

/**
 * Stub for Drive testing
 */
export class FakeDrive {}

export class FakeNewDataValidation {
  requireFormulaSatisfied() {
    return this;
  }

  build() {}
}

class FakeBandings {}

class FakeTextStyle {
  setBold() {
    return this;
  }

  setItalic() {
    return this;
  }

  setFontSize() {
    return this;
  }

  setForegroundColor() {
    return this;
  }

  setFontFamily() {
    return this;
  }

  build() {
    return this;
  }
}

class FakeRichTextValue {
  text: string;

  setText(text: string) {
    this.text = text;
    return this;
  }

  setTextStyle() {
    return this;
  }

  build() {
    return this;
  }

  getText() {
    return this.text;
  }
}

class FakeFilter {}

class FakeBigQuery {
  Jobs = new FakeBigQueryJobs();
}

class FakeBigQueryJobs {
  query: () => BigQuery.Schema.QueryResponse = () => {
    throw new Error('Not implemented');
  };
}

// findLastIndex isn't properly supported in TypeScript definitions at the moemnt.
declare global {
  interface Array<T> {
    /**
     * Returns the value of the last element in the array where predicate is true, and undefined
     * otherwise.
     * @param predicate findLast calls predicate once for each element of the array, in descending
     * order, until it finds one where predicate returns true. If such an element is found, findLast
     * immediately returns that element value. Otherwise, findLast returns undefined.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    findLast<S extends T>(
      predicate: (value: T, index: number, array: T[]) => value is S,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thisArg?: any,
    ): S | undefined;
    findLast(
      predicate: (value: T, index: number, array: T[]) => unknown,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thisArg?: any,
    ): T | undefined;

    /**
     * Returns the index of the last element in the array where predicate is true, and -1
     * otherwise.
     * @param predicate findLastIndex calls predicate once for each element of the array, in descending
     * order, until it finds one where predicate returns true. If such an element is found,
     * findLastIndex immediately returns that element index. Otherwise, findLastIndex returns -1.
     * @param thisArg If provided, it will be used as the this value for each invocation of
     * predicate. If it is not provided, undefined is used instead.
     */
    findLastIndex(
      predicate: (value: T, index: number, array: T[]) => unknown,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thisArg?: any,
    ): number;

    /**
     * Returns a copy of an array with its elements reversed.
     */
    toReversed(): T[];

    /**
     * Returns a copy of an array with its elements sorted.
     * @param compareFn Function used to determine the order of the elements. It is expected to return
     * a negative value if the first argument is less than the second argument, zero if they're equal, and a positive
     * value otherwise. If omitted, the elements are sorted in ascending, ASCII character order.
     * ```ts
     * [11, 2, 22, 1].toSorted((a, b) => a - b) // [1, 2, 11, 22]
     * ```
     */
    toSorted(compareFn?: (a: T, b: T) => number): T[];

    /**
     * Copies an array and removes elements and, if necessary, inserts new elements in their place. Returns the copied array.
     * @param start The zero-based location in the array from which to start removing elements.
     * @param deleteCount The number of elements to remove.
     * @param items Elements to insert into the copied array in place of the deleted elements.
     * @returns The copied array.
     */
    toSpliced(start: number, deleteCount: number, ...items: T[]): T[];

    /**
     * Copies an array and removes elements while returning the remaining elements.
     * @param start The zero-based location in the array from which to start removing elements.
     * @param deleteCount The number of elements to remove.
     * @returns A copy of the original array with the remaining elements.
     */
    toSpliced(start: number, deleteCount?: number): T[];

    /**
     * Copies an array, then overwrites the value at the provided index with the
     * given value. If the index is negative, then it replaces from the end
     * of the array.
     * @param index The index of the value to overwrite. If the index is
     * negative, then it replaces from the end of the array.
     * @param value The value to write into the copied array.
     * @returns The copied array with the updated value.
     */
    with(index: number, value: T): T[];
  }
}
