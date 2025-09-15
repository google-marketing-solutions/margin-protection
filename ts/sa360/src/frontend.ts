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
 * @fileoverview This file contains the frontend and Apps Script hooks for the
 * SA360 Launch Monitor. It defines the main `SearchAdsFrontend` class that
 * orchestrates the user interface and interactions within Google Sheets.
 */

import {
  AppsScriptFrontend,
  getTemplateSetting,
  HELPERS,
} from 'common/sheet_helpers';
import { FrontendArgs, ParamDefinition, RuleExecutor } from 'common/types';
import { SearchAdsClientTypes } from 'sa360/src/types';

/**
 * The name of the general settings sheet.
 */
export const GENERAL_SETTINGS_SHEET = 'General/Settings';

/**
 * The name of the label range in Apps Script.
 */
export const LABEL_RANGE = 'LABEL';

/**
 * The name of the email list range in Apps Script.
 */
export const EMAIL_LIST_RANGE = 'EMAIL_LIST';

// NEW SA360 API variables
const LOGIN_CUSTOMER_ID = 'LOGIN_CUSTOMER_ID';
const CUSTOMER_IDS = 'CUSTOMER_IDS';

// Common variables
const FULL_FETCH_RANGE = 'FULL_FETCH';

/**
 * A record of migration functions, indexed by version string. This is currently
 * empty as no migrations have been defined for this version.
 */
export const migrations: Record<string, (frontend: SearchAdsFrontend) => void> =
  {};

/**
 * The main frontend class for the SA360 Launch Monitor. It extends the generic
 * `AppsScriptFrontend` to provide SA360-specific implementations for
 * identity management and UI interactions.
 */
export class SearchAdsFrontend extends AppsScriptFrontend<SearchAdsClientTypes> {
  /**
   * @param args The frontend arguments for initialization.
   */
  constructor(args: FrontendArgs<SearchAdsClientTypes>) {
    super('SA360', args);
  }

  /**
   * Cleans a customer ID string by removing hyphens and spaces.
   * @param cid The customer ID to clean.
   * @return The cleaned customer ID.
   * @private
   */
  private cleanCid(cid: string | number) {
    return String(cid).replace(/[- ]/g, '');
  }

  /**
   * Reads the Login Customer ID and Customer IDs from named ranges in the sheet
   * to identify the client context.
   * @return The client arguments for initializing the `Client`.
   */
  override getIdentity() {
    const loginCustomerId = HELPERS.getValueFromRangeByName({
      name: LOGIN_CUSTOMER_ID,
      allowEmpty: true,
    });
    const customerIdsDirty = HELPERS.getValueFromRangeByName({
      name: CUSTOMER_IDS,
      allowEmpty: false,
    });
    const label = HELPERS.getValueFromRangeByName({
      name: LABEL_RANGE,
      allowEmpty: true,
    });
    const customerIds = this.cleanCid(customerIdsDirty);

    return {
      loginCustomerId: loginCustomerId
        ? this.cleanCid(loginCustomerId)
        : customerIds,
      customerIds,
      label: String(label || customerIds),
    };
  }

  /**
   * Displays a custom HTML modal dialog for initial tool setup.
   * @return The advertiser ID value from the setup modal.
   */
  override displaySetupModal() {
    const template = HtmlService.createTemplateFromFile('html/setup');
    template['agencyId'] =
      HELPERS.getRangeByName(LOGIN_CUSTOMER_ID).getValue() || '';
    template['advertiserId'] =
      HELPERS.getRangeByName(CUSTOMER_IDS).getValue() || '';
    const htmlOutput = template.evaluate().setWidth(350).setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Set up');

    return template['advertiserID'];
  }

  /**
   * Runs all enabled rules and displays the results in a 'Pre-Launch QA
   * Results' sheet.
   */
  override async preLaunchQa() {
    await super.preLaunchQa();
  }

  /**
   * Initializes the frontend by running migrations and setting up the rule
   * sheets.
   */
  override async initializeSheets() {
    await super.initializeSheets();
  }

  /**
   * Saves the current settings for all rules back to their respective sheets
   * and resets the `FULL_FETCH` flag.
   * @param rules An array of all rule executor instances.
   */
  override saveSettingsBackToSheets(
    rules: Array<
      RuleExecutor<SearchAdsClientTypes, Record<string, ParamDefinition>>
    >,
  ) {
    super.saveSettingsBackToSheets(rules);
    getTemplateSetting(FULL_FETCH_RANGE).setValue('FALSE');
    this.client.args.fullFetch = false;
  }
}
