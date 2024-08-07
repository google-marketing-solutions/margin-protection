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
 * @fileoverview Implement and bootstrap Apps Script.
 */

import {
  CredentialManager,
  GoogleAdsApiFactory,
  ReportFactory,
  SA360_API_ENDPOINT,
} from 'common/ads_api';
import { AppsScriptPropertyStore } from 'common/sheet_helpers';
import { PropertyStore } from 'common/types';
import { Client, RuleRange } from 'sa360/src/client';
import {
  budgetPacingRule,
  campaignStatusRule,
  adGroupStatusRule,
  adGroupAudienceTargetRule,
  ageTargetRule,
  genderTargetRule,
  geoTargetRule,
  campaignAudienceTargetRule,
} from 'sa360/src/rules';
<<<<<<< HEAD
=======

>>>>>>> 899bc9c (fix back to v2)
import { migrations, SearchAdsFrontend } from './frontend';

/**
 * The sheet version the app currently has.
 *
 * This is used to manage migrations from one version of Launch Monitor to
 * another.
 */
export const CURRENT_SHEET_VERSION = '2.0';

/**
 * Generate a front-end object for lazy loading.
 */
export function getFrontend(properties: PropertyStore) {
  return new SearchAdsFrontend({
    ruleRangeClass: RuleRange,
    rules: [
      budgetPacingRule,
      campaignStatusRule,
      adGroupStatusRule,
      adGroupAudienceTargetRule,
      ageTargetRule,
      genderTargetRule,
      geoTargetRule,
      campaignAudienceTargetRule,
    ],
    version: CURRENT_SHEET_VERSION,
    clientInitializer(clientArgs, properties) {
      const apiFactory = new GoogleAdsApiFactory({
        developerToken: '',
        credentialManager: new CredentialManager(),
        apiEndpoint: SA360_API_ENDPOINT,
      });
      const reportFactory = new ReportFactory(apiFactory, clientArgs);
      return new Client(clientArgs, properties, reportFactory);
    },
    migrations,
    properties,
  });
}

function onOpen(properties = new AppsScriptPropertyStore()) {
  getFrontend(properties).onOpen();
}

function initializeSheets(properties = new AppsScriptPropertyStore()) {
  getFrontend(properties).initializeSheets();
}

function initializeRules(properties = new AppsScriptPropertyStore()) {
  getFrontend(properties).initializeRules();
}

function preLaunchQa(properties = new AppsScriptPropertyStore()) {
  getFrontend(properties).preLaunchQa();
}

function launchMonitor(properties = new AppsScriptPropertyStore()) {
  getFrontend(properties).launchMonitor();
}

function displayGlossary(properties = new AppsScriptPropertyStore()) {
  getFrontend(properties).launchMonitor();
}

global.onOpen = onOpen;
global.initializeSheets = initializeSheets;
global.initializeRules = initializeRules;
global.preLaunchQa = preLaunchQa;
global.launchMonitor = launchMonitor;
global.displayGlossary = displayGlossary;
