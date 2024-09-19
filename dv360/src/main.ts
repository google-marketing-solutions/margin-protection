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

import { PropertyStore } from 'common/types';

import { Client, RuleRange } from './client';
import { DisplayVideoFrontend, migrations } from './frontend';
import {
  budgetPacingRuleLineItem,
  budgetPacingPercentageRule,
  geoTargetRule,
  impressionsByGeoTarget,
} from './rules';
import { AppsScriptPropertyStore } from 'common/sheet_helpers';

/**
 * The sheet version the app currently has.
 *
 * This is used to manage migrations from one version of Launch Monitor to
 * another.
 */
export const CURRENT_SHEET_VERSION = '1.5';

/**
 * Retrieves the front-end as a function.
 *
 * @param properties A {@link PropertyStore} is used to update client configuration
 *   for client libraries when using a server/client relationship.
 */
export function getFrontend(
  properties: PropertyStore = new AppsScriptPropertyStore(),
) {
  return new DisplayVideoFrontend({
    ruleRangeClass: RuleRange,
    rules: [
      budgetPacingRuleLineItem,
      budgetPacingPercentageRule,
      geoTargetRule,
      impressionsByGeoTarget,
    ],
    version: CURRENT_SHEET_VERSION,
    clientInitializer(clientArgs, properties) {
      return new Client(clientArgs, properties);
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

global.onOpen = onOpen;
global.initializeSheets = initializeSheets;
global.initializeRules = initializeRules;
global.preLaunchQa = preLaunchQa;
global.launchMonitor = launchMonitor;
