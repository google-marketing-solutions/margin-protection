/**
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
 * @fileoverview Constants for Apps Script based front-ends.
 */

export const FOLDER = 'application/vnd.google-apps.folder';
export const HEADER_RULE_NAME_INDEX = 0;

/**
 * The number of headers at the top of a rule sheet.
 */
export const SHEET_TOP_PADDING = 2;

/**
 * Used to figure out the list of email addresses to send emails to.
 */
export const EMAIL_LIST_RANGE = 'EMAIL_LIST';
/**
 * Used to distinguish between different reports (e.g. advertiser name)
 */
export const LABEL_RANGE = 'LABEL';

/**
 * The name of the rule settings sheet (before granularity).
 */
export const RULE_SETTINGS_SHEET = 'Rule Settings';

/**
 * The name of the general settings sheet.
 */
export const GENERAL_SETTINGS_SHEET = 'General/Settings';

/**
 * Used to figure out the GCP project name. May be blank (if BigQuery isn't used).
 */
export const GCP_PROJECT_RANGE = 'GCP_PROJECT_ID';

/**
 * The named range for the export settings.
 */
export const EXPORT_SETTINGS_RANGE = 'EXPORT_SETTINGS';
