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

/***
 * @fileoverview The client implementation. Connects to a library for
 *   centrally managed distributions. This usage is optional, but allows for
 *   ops teams to update code in a central location.
 */

declare global {
  const LaunchMonitor: Exported;
}

import { PropertyStore } from '#common/types.js';

import { AppsScriptPropertyStore } from '#common/sheet_helpers/index.js';

interface Exported {
  onOpen(properties: PropertyStore): void;
  initializeSheets(properties: PropertyStore): void;
  initializeRules(properties: PropertyStore): void;
  preLaunchQa(properties: PropertyStore): void;
  launchMonitor(properties: PropertyStore): void;
  displayGlossary(properties: PropertyStore): void;
  displaySetupGuide(properties: PropertyStore): void;
  dynamicFields(): Record<string, unknown>;
  getSettings(properties: PropertyStore): string | undefined;
}

function onOpen() {
  LaunchMonitor.onOpen(new AppsScriptPropertyStore());
}

function initializeSheets() {
  LaunchMonitor.initializeSheets(new AppsScriptPropertyStore());
}

function initializeRules() {
  LaunchMonitor.initializeRules(new AppsScriptPropertyStore());
}

function preLaunchQa() {
  LaunchMonitor.preLaunchQa(new AppsScriptPropertyStore());
}

function launchMonitor() {
  LaunchMonitor.launchMonitor(new AppsScriptPropertyStore());
}

function displayGlossary() {
  LaunchMonitor.displayGlossary(new AppsScriptPropertyStore());
}

function displaySetupGuide() {
  LaunchMonitor.displaySetupGuide(new AppsScriptPropertyStore());
}

function dynamicFields() {
  return LaunchMonitor.dynamicFields();
}

function getSettings() {
  return LaunchMonitor.getSettings(new AppsScriptPropertyStore());
}

global.onOpen = onOpen;
global.initializeSheets = initializeSheets;
global.initializeRules = initializeRules;
global.launchMonitor = launchMonitor;
global.preLaunchQa = preLaunchQa;
global.displayGlossary = displayGlossary;
global.displaySetupGuide = displaySetupGuide;
global.dynamicFields = dynamicFields;
global.getSettings = getSettings;
