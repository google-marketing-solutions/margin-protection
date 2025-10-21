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
 * Create a well-formatted setting with a bold headline and a small description.
 *
 * Uses rich-text to put the info into a single cell.
 * @param sheet The spreadsheet to change.
 * @param rangeName The range to adjust (A1 notation).
 * @param text A tuple. The first value is the headline and the second the
 *     description.
 */
export function addSettingWithDescription(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  rangeName: string,
  text: [headline: string, description: string],
) {
  const bold = SpreadsheetApp.newTextStyle().setBold(true).build();
  const small = SpreadsheetApp.newTextStyle()
    .setFontSize(8)
    .setItalic(true)
    .build();
  sheet.getRange(rangeName).setRichTextValue(
    SpreadsheetApp.newRichTextValue()
      .setText(text.join('\n'))
      .setTextStyle(0, text[0].length, bold)
      .setTextStyle(text[0].length, text[0].length + text[1].length, small)
      .build(),
  );
}
