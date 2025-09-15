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
 * @fileoverview This file is the main entry point for the SA360 Launch Monitor
 * when running in the Google Apps Script environment. It initializes the
 * `SearchAdsFrontend` and exposes its methods as global functions that can be
 * called from the spreadsheet UI or by Apps Script triggers.
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

import { migrations, SearchAdsFrontend } from './frontend';

/**
 * The sheet version the app currently has.
 *
 * This is used to manage migrations from one version of Launch Monitor to
 * another.
 */
export const CURRENT_SHEET_VERSION = '2.0';

/**
 * A factory function that instantiates and configures the `SearchAdsFrontend`.
 *
 * It injects all necessary dependencies, including the rule definitions, the
 * `Client` initializer (which sets up the Ads API factories), migration
 * functions, and the property store.
 *
 * @param properties An implementation of `PropertyStore` for handling script
 *     properties.
 * @return A fully configured instance of `SearchAdsFrontend`.
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

/**
 * An Apps Script `onOpen` simple trigger that adds a custom menu to the
 * spreadsheet UI.
 */
async function onOpen(
  _: GoogleAppsScript.Events.SheetsOnOpen,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).onOpen();
}

/**
 * A global function to initialize the sheets. Can be called from the UI.
 */
async function initializeSheets(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).initializeSheets();
}

/**
 * A global function to initialize the rules. Can be called from the UI.
 */
async function initializeRules(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).initializeRules();
}

/**
 * A global function to run the pre-launch QA. Can be called from the UI.
 */
async function preLaunchQa(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).preLaunchQa();
}

/**
 * A global function to run the launch monitor. Intended to be used as a
 * time-based trigger.
 */
async function launchMonitor(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).launchMonitor();
}

/**
 * A global function to display the setup modal. Can be called from the UI.
 */
async function displaySetupModal(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).displaySetupModal();
}

/**
 * A global function to display the rule glossary. Can be called from the UI.
 */
function displayGlossary(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  getFrontend(properties).displayGlossary();
}

// Expose public functions to the Apps Script global object.
global.onOpen = onOpen;
global.initializeSheets = initializeSheets;
global.initializeRules = initializeRules;
global.preLaunchQa = preLaunchQa;
global.launchMonitor = launchMonitor;
global.displaySetupModal = displaySetupModal;
global.displayGlossary = displayGlossary;
