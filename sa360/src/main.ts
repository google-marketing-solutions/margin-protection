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
 * @fileoverview Implement and bootstrap Apps Script.
 *
 * BEGIN-INTERNAL
 * This can and should be excluded and re-written in customer-specific
 * implementations.
 * END-INTERNAL
 */

import {lazyLoadApp, toExport} from 'common/sheet_helpers';
import {ClientArgs, ClientInterface, RuleGranularity} from 'sa360/src/types';
import {Client, RuleRange} from 'sa360/src/client';
import {PropertyStore} from 'anomaly_library/main';

import {migrations, SearchAdsFrontEnd} from './frontend';

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
export function getFrontEnd(properties: PropertyStore) {
  return new SearchAdsFrontEnd({
    ruleRangeClass: RuleRange,
    rules: [
    ],
    version: CURRENT_SHEET_VERSION,
    clientClass: Client,
    migrations,
    properties,
  });
}

lazyLoadApp<ClientInterface, RuleGranularity, ClientArgs, SearchAdsFrontEnd>(getFrontEnd);

global.onOpen = toExport.onOpen;
global.initializeSheets = toExport.initializeSheets;
global.launchMonitor = toExport.launchMonitor;
global.preLaunchQa = toExport.preLaunchQa;