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

<<<<<<< HEAD
import { AppsScriptFrontend, getTemplateSetting } from 'common/sheet_helpers';
=======
import {
  AppsScriptFrontend,
  AppsScriptPropertyStore,
  RULE_SETTINGS_SHEET,
  addSettingWithDescription,
  getOrCreateSheet,
  getTemplateSetting,
} from 'common/sheet_helpers';
>>>>>>> 06e966e (remove g3-format-prettier)
import { FrontendArgs, ParamDefinition, RuleExecutor } from 'common/types';
import { RuleRange } from 'sa360/src/client';
import { ClientArgs, ClientInterface, RuleGranularity } from 'sa360/src/types';

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
 * Migrations for the new SA360  Launch Monitor
 */
export const migrations: Record<string, (frontend: SearchAdsFrontend) => void> =
  {};

/**
 * Front-end configuration for the new SA360 (our ) Apps Script.
 */
export class SearchAdsFrontend extends AppsScriptFrontend<
  ClientInterface,
  RuleGranularity,
  ClientArgs,
  SearchAdsFrontend
> {
  constructor(
    args: FrontendArgs<
      ClientInterface,
      RuleGranularity,
      ClientArgs,
      SearchAdsFrontend
    >,
  ) {
    super('SA360', args);
  }

  private cleanCid(cid: string | number) {
    return String(cid).replace(/[- ]/, '');
  }

  override getIdentity() {
    const loginCustomerId = this.getValueFromRangeByName({
      name: LOGIN_CUSTOMER_ID,
      allowEmpty: true,
    });
    const customerIdsDirty = this.getValueFromRangeByName({
      name: CUSTOMER_IDS,
      allowEmpty: false,
    });
    const label = this.getValueFromRangeByName({
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

  override displaySetupModal() {
    const template = HtmlService.createTemplateFromFile('html/setup');
    template['agencyId'] =
      this.getRangeByName(LOGIN_CUSTOMER_ID).getValue() || '';
    template['advertiserId'] =
      this.getRangeByName(CUSTOMER_IDS).getValue() || '';
    const htmlOutput = template.evaluate().setWidth(350).setHeight(400);
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
      RuleExecutor<
        ClientInterface,
        RuleGranularity,
        ClientArgs,
        Record<string, ParamDefinition>
      >
    >,
  ) {
    super.saveSettingsBackToSheets(rules);
    getTemplateSetting(FULL_FETCH_RANGE).setValue('FALSE');
    this.client.args.fullFetch = false;
  }
}
