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
 *
 * BEGIN-INTERNAL
 * This can and should be excluded and re-written in customer-specific
 * implementations.
 * END-INTERNAL
 */

// g3-format-prettier

import {
  CredentialManager,
  GoogleAdsApiFactory,
  ReportFactory,
  SA360_API_ENDPOINT,
} from "common/ads_api";
import { lazyLoadApp, toExport } from "common/sheet_helpers";
import { PropertyStore } from "common/types";
import { ClientV2, RuleRangeV2 } from "sa360/src/client";

import { migrationsV2, NewSearchAdsFrontEnd } from "./frontend";
import { ClientArgsV2, ClientInterfaceV2, RuleGranularity } from "./types";

/**
 * The sheet version the app currently has.
 *
 * This is used to manage migrations from one version of Launch Monitor to
 * another.
 */
export const CURRENT_SHEET_VERSION = "2.0";

/**
 * Generate a front-end object for lazy loading.
 */
export function getFrontEnd(properties: PropertyStore) {
  return new NewSearchAdsFrontEnd({
    ruleRangeClass: RuleRangeV2,
    rules: [],
    version: CURRENT_SHEET_VERSION,
    clientInitializer(clientArgs, properties) {
      const apiFactory = new GoogleAdsApiFactory({
        developerToken: "",
        credentialManager: new CredentialManager(),
        apiEndpoint: SA360_API_ENDPOINT,
      });
      const reportFactory = new ReportFactory(apiFactory, clientArgs);
      return new ClientV2(clientArgs, properties, reportFactory);
    },
    migrations: migrationsV2,
    properties,
  });
}

lazyLoadApp<
  ClientInterfaceV2,
  RuleGranularity,
  ClientArgsV2,
  NewSearchAdsFrontEnd
>(getFrontEnd);

global.onOpen = toExport.onOpen;
global.initializeSheets = toExport.initializeSheets;
global.launchMonitor = toExport.launchMonitor;
global.preLaunchQa = toExport.preLaunchQa;
