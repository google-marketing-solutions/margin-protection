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
 * @fileoverview frontend/apps script hooks for SA360 launch monitor
 */

import { ALL_MIGRATIONS } from '#common/migrations/index.js';
import {
  AppsScriptFrontend,
  getTemplateSetting,
  HELPERS,
} from '#common/sheet_helpers/index.js';
import { FrontendArgs, ParamDefinition, RuleExecutor } from '#common/types.js';
import { SearchAdsClientTypes } from '#sa360/types.js';

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
 * Front-end configuration for the new SA360 (our V2) Apps Script.
 */
export class SearchAdsFrontend extends AppsScriptFrontend<SearchAdsClientTypes> {
  private constructor(args: FrontendArgs<SearchAdsClientTypes>) {
    super('sa360', { ...args, migrations: ALL_MIGRATIONS });
  }

  static withIdentity(args: FrontendArgs<SearchAdsClientTypes>) {
    const frontend = new SearchAdsFrontend(args);
    frontend.initialize();
    return frontend;
  }

  private cleanCid(cid: string | number) {
    return String(cid).replace(/[- ]/g, '');
  }

  override getIdentityFields() {
    return {
      [LOGIN_CUSTOMER_ID]: {
        label: 'Login Customer ID',
        value: this.getIdentityFieldValue(LOGIN_CUSTOMER_ID),
      },
      [CUSTOMER_IDS]: {
        label: 'Customer IDs',
        value: this.getIdentityFieldValue(CUSTOMER_IDS),
      },
      [LABEL_RANGE]: {
        label: 'Label',
        value: this.getIdentityFieldValue(LABEL_RANGE),
      },
      ...super.getIdentityFields(),
    };
  }

  override getIdentity() {
    const {
      [LOGIN_CUSTOMER_ID]: { value: loginCustomerId },
      [CUSTOMER_IDS]: { value: customerIdsDirty },
      [LABEL_RANGE]: { value: label },
    } = this.getIdentityFields();

    const customerIds = this.cleanCid(customerIdsDirty);

    return {
      loginCustomerId: loginCustomerId
        ? this.cleanCid(loginCustomerId)
        : customerIds,
      customerIds,
      label: String(label || customerIds),
    };
  }

  override displaySetupGuide() {
    this.migrate();
    const template = HtmlService.createTemplateFromFile('html/setup');
    template['agencyId'] =
      HELPERS.getRangeByName(LOGIN_CUSTOMER_ID).getValue() || '';
    template['advertiserId'] =
      HELPERS.getRangeByName(CUSTOMER_IDS).getValue() || '';
    template['dynamicFields'] = JSON.stringify(this.getIdentityFields());
    template['settings'] = this.getSettings();
    const htmlOutput = template.evaluate().setWidth(450).setHeight(600);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Set up');

    return template['advertiserID'];
  }

  override async preLaunchQa() {
    await super.preLaunchQa();
  }

  override async initializeSheets() {
    await super.initializeSheets();
  }

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
