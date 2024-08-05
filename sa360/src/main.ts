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

<<<<<<< HEAD
import { migrations, SearchAdsFrontend } from './frontend';
=======
import { migrationsV2, NewSearchAdsFrontend } from './frontend';
import { ClientArgsV2, ClientInterfaceV2, RuleGranularity } from './types';
>>>>>>> 496c709 (Minor cleanup (#13))

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
<<<<<<< HEAD
  return new SearchAdsFrontend({
    ruleRangeClass: RuleRange,
=======
  return new NewSearchAdsFrontend({
    ruleRangeClass: RuleRangeV2,
>>>>>>> 496c709 (Minor cleanup (#13))
    rules: [],
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

<<<<<<< HEAD
function onOpen(properties = new AppsScriptPropertyStore()) {
  getFrontend(properties).onOpen();
}
=======
lazyLoadApp<
  ClientInterfaceV2,
  RuleGranularity,
  ClientArgsV2,
  NewSearchAdsFrontend
>(getFrontend);
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
