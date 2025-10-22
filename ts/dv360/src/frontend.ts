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
 * @fileoverview frontend/apps script hooks for DV360 launch monitor
 */

import { ALL_MIGRATIONS } from '#common/migrations/index.js';
import { LEGACY_MIGRATIONS } from '#common/migrations/legacy_migrations.js';
import {
  AppsScriptFrontend,
  HELPERS,
  LABEL_RANGE,
} from '#common/sheet_helpers/index.js';
import { FrontendArgs, FrontendInterface } from '#common/types.js';
import { IDType, DisplayVideoClientTypes } from './types.js';

const ENTITY_ID = 'ENTITY_ID';
const ID_TYPE = 'ID_TYPE';

/**
 * The name of the general settings sheet.
 */
export const GENERAL_SETTINGS_SHEET = 'General/Settings';

/**
 * Front-end configuration for DV360 Apps Script.
 */
export class DisplayVideoFrontend
  extends AppsScriptFrontend<DisplayVideoClientTypes>
  implements FrontendInterface<DisplayVideoClientTypes>
{
  constructor(args: FrontendArgs<DisplayVideoClientTypes>) {
    super('dv360', {
      ...args,
      migrations: ALL_MIGRATIONS,
      legacyMigrations: LEGACY_MIGRATIONS,
    });
  }

  override getIdentity() {
    const sheet = SpreadsheetApp.getActive();
    if (!sheet) {
      throw new Error('There is no active spreadsheet.');
    }
    const label = sheet.getRangeByName(LABEL_RANGE);
    const idRange = sheet.getRangeByName(ENTITY_ID);
    const idTypeRange = sheet.getRangeByName(ID_TYPE);
    if (!idRange || !idTypeRange) {
      return null;
    }
    const idType = idTypeRange.getValue();
    return {
      id: idRange.getValue(),
      idType: idType === 'Advertiser' ? IDType.ADVERTISER : IDType.PARTNER,
      label: label?.getValue() || `${idType} ${idRange.getValue()}`,
      name: label?.getValue(),
    };
  }

  override displaySetupModal() {
    const template = HtmlService.createTemplateFromFile('setup');
    template['id'] = HELPERS.getRangeByName(ENTITY_ID).getValue() || '';
    template['idType'] = HELPERS.getRangeByName(ID_TYPE).getValue() || '';
    const htmlOutput = template.evaluate().setWidth(350).setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Set up');
    return template['id'];
  }
}
