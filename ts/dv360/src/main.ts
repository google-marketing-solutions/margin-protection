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
 * @fileoverview Apps Script handlers.
 */

import { PropertyStore } from '#common/types.js';

import { Client, RuleRange } from './client.js';
import { DisplayVideoFrontend } from './frontend.js';
import {
  budgetPacingRuleLineItem,
  budgetPacingPercentageRule,
  geoTargetRule,
  impressionsByGeoTarget,
  dailyBudgetRule,
} from './rules.js';
import { AppsScriptPropertyStore } from '#common/sheet_helpers/index.js';
const CURRENT_SHEET_VERSION = global.CURRENT_SHEET_VERSION || '';
global.CURRENT_SHEET_VERSION = CURRENT_SHEET_VERSION;

/**
 * Retrieves the front-end as a function.
 *
 * @param properties A {@link PropertyStore} is used to update client configuration
 *   for client libraries when using a server/client relationship.
 */
export function getFrontend(
  properties: PropertyStore = new AppsScriptPropertyStore(),
) {
  return DisplayVideoFrontend.withIdentity({
    ruleRangeClass: RuleRange,
    rules: [
      budgetPacingRuleLineItem,
      budgetPacingPercentageRule,
      dailyBudgetRule,
      geoTargetRule,
      impressionsByGeoTarget,
    ],
    version: CURRENT_SHEET_VERSION,
    clientInitializer(clientArgs, properties) {
      return new Client(clientArgs, properties);
    },
    properties,
  });
}

async function onOpen(
  _: GoogleAppsScript.Events.SheetsOnOpen,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).onOpen();
}

async function initializeSheets(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).initializeSheets();
}

async function initializeRules(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).initializeRules();
}

async function preLaunchQa(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).preLaunchQa();
}

async function launchMonitor(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).launchMonitor();
}

async function displaySetupGuide(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  await getFrontend(properties).displaySetupGuide();
}

function displayGlossary(
  _: GoogleAppsScript.Events.TimeDriven,
  properties = new AppsScriptPropertyStore(),
) {
  getFrontend(properties).displayGlossary();
}

function getSettings(properties = new AppsScriptPropertyStore()) {
  return getFrontend(properties).getSettings();
}

function dynamicFields() {
  const { id, idType } = getFrontend().getIdentity() ?? {};
  return { id, idType };
}

global.onOpen = onOpen;
global.initializeSheets = initializeSheets;
global.initializeRules = initializeRules;
global.preLaunchQa = preLaunchQa;
global.launchMonitor = launchMonitor;
global.displaySetupGuide = displaySetupGuide;
global.displayGlossary = displayGlossary;
global.getSettings = getSettings;
global.dynamicFields = dynamicFields;
