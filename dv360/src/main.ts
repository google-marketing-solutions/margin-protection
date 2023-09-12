/**
 * @license
 * Copyright 2023 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * g3-format-prettier
 * @fileoverview Apps Script handlers.
 */

import {
  lazyLoadApp,
  toExport,
} from 'common/sheet_helpers';

import {PropertyStore} from 'anomaly_library/main';
import {Client, RuleRange} from './client';
import {DisplayVideoFrontEnd, migrations} from './frontend';
import {
  budgetPacingDaysAheadRule,
  budgetPacingPercentageRule,
  dailyBudgetRule,
  geoTargetRule,
  impressionsByGeoTarget,
} from './rules';
import {ClientArgs, ClientInterface, RuleGranularity} from './types';

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
 * Broken out for testability.
 */
export function getFrontEnd(properties: PropertyStore) {
  return new DisplayVideoFrontEnd({
    ruleRangeClass: RuleRange,
    rules: [
      budgetPacingDaysAheadRule,
      budgetPacingPercentageRule,
      dailyBudgetRule,
      geoTargetRule,
      impressionsByGeoTarget,
    ],
    version: CURRENT_SHEET_VERSION,
    clientClass: Client,
    migrations,
    properties,
  });
}

/**
 * The application functions.
 *
 * Exported for testing.
 */
lazyLoadApp<ClientInterface, RuleGranularity, ClientArgs, DisplayVideoFrontEnd>(
  getFrontEnd,
);

global.onOpen = toExport.onOpen;
global.initializeSheets = toExport.initializeSheets;
global.launchMonitor = toExport.launchMonitor;
global.preLaunchQa = toExport.preLaunchQa;
global.displayGlossary = toExport.displayGlossary;
global.displaySetupGuide = toExport.displaySetupGuide;
