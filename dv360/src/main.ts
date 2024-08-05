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

<<<<<<< HEAD
=======
import { lazyLoadApp, toExport } from 'common/sheet_helpers';
>>>>>>> 496c709 (Minor cleanup (#13))
import { PropertyStore } from 'common/types';

import { Client, RuleRange } from './client';
import { DisplayVideoFrontend, migrations } from './frontend';
import {
  budgetPacingDaysAheadRule,
  budgetPacingPercentageRule,
  dailyBudgetRule,
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
<<<<<<< HEAD
export function getFrontend(
  properties: PropertyStore = new AppsScriptPropertyStore(),
) {
=======
export function getFrontend(properties: PropertyStore) {
>>>>>>> 496c709 (Minor cleanup (#13))
  return new DisplayVideoFrontend({
    ruleRangeClass: RuleRange,
    rules: [
      budgetPacingDaysAheadRule,
      budgetPacingPercentageRule,
      dailyBudgetRule,
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

<<<<<<< HEAD
function onOpen(properties = new AppsScriptPropertyStore()) {
  getFrontend(properties).onOpen();
}
=======
/**
 * The application functions.
 *
 * Exported for testing.
 */
lazyLoadApp<ClientInterface, RuleGranularity, ClientArgs, DisplayVideoFrontend>(
  getFrontend,
);
>>>>>>> 496c709 (Minor cleanup (#13))

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
