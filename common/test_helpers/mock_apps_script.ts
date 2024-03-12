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

// g3-format-prettier

import {PropertyStore} from 'common/types';

import Properties = GoogleAppsScript.Properties;
import Cache = GoogleAppsScript.Cache;
import Mail = GoogleAppsScript.Mail;

function a1NotationToRowColumn(a1Notation: string, start = true) {
  const a = 'A'.charCodeAt(0);
  let column = 0;
  let i;
  const parts = a1Notation.toUpperCase().match(/([A-Z]+)([1-9]\d*)?/);
  if (!parts) {
    throw new Error('Invalid A1 notation');
  }
  const letters = parts[1];
  const row: number = parts[2] ? Number.parseInt(parts[2], 10) :
      start                    ? 1 :
                                 100_000;
  for (i = 0; i < letters.length; i++) {
    column += letters.charCodeAt(i) - a;
  }

  return {row, column};
}

class FakeRange {
  private readonly arrayRange: string[][];

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
    if (this.arrayRange.length !== range.length) {
      throw new Error('Invalid row length');
    }
    for (const [i, row] of range.entries()) {
      if (row.length === this.arrayRange[0].length) {
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
    return this;
  }

  clearDataValidations(): FakeRange {
    return this;
  }
}

class FakeSheet {
  readonly cells: string[][] = Array.from({length: 100}).map((unused) =>
    Array.from({length: 30}),
  );
  lastRow = 1;
  lastColumn = 1;

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
    this.lastRow = (numRows ?? 0) + arg1 - 1;
    this.lastColumn = (numColumns ?? 0) + column - 1;
    return new FakeRange(this, arg1, column, numRows, numColumns);
  }

  getDataRange(): FakeRange {
    return new FakeRange(this, 1, 1, this.lastRow, this.lastColumn);
  }

  clear(): FakeSheet {
    const emptyCells = this.cells.map((row) => row.map((col) => ''));
    this.cells.splice(0, this.cells.length, ...emptyCells);
    return this;
  }
}

class FakeHtmlService {
  createTemplateFromFile(file: string) {
    throw new Error('Not implemented. Stub me.');
  }
}

class FakeSpreadsheet {
  private static lastNum = 1;
  private readonly namedRange: Record<string, FakeRange> = {};
  private readonly sheets: Record<string, FakeSheet> = {
    'Sheet1': new FakeSheet(),
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

  getActive() {
    return this.fakeSpreadsheet;
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
  (globalThis.Utilities as unknown as FakeUtilities) = new FakeUtilities();
  (globalThis.HtmlService as unknown as FakeHtmlService) =
    new FakeHtmlService();
}

class FakeScriptApp {
  getOAuthToken() {
    return 'token';
  }
}

class FakeUtilities {
  parseCsv(text: string) {
    // We don't need a special package because this test CSV is very
    // basic. No escaping, etc.
    const lines = text.split('\n').map((line: string) => line.split(','));
    return lines;
  }

  sleep(msecs: number) {
    console.info(`skip sleep for ${msecs}`);
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

  getAll(keys: string[]): Record<string, string> {
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
