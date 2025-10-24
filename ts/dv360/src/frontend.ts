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
  private constructor(args: FrontendArgs<DisplayVideoClientTypes>) {
    super('dv360', {
      ...args,
      migrations: ALL_MIGRATIONS,
      legacyMigrations: LEGACY_MIGRATIONS,
    });
  }

  static withIdentity(args: FrontendArgs<DisplayVideoClientTypes>) {
    const frontend = new DisplayVideoFrontend(args);
    frontend.initialize();
    return frontend;
  }

  override getIdentityFields() {
    return {
      label: { label: 'Label', value: this.getIdentityFieldValue(LABEL_RANGE) },
      id: { label: 'Entity ID', value: this.getIdentityFieldValue(ENTITY_ID) },
      idType: { label: 'ID Type', value: this.getIdentityFieldValue(ID_TYPE) },
      ...super.getIdentityFields(),
    };
  }

  override getIdentity() {
    const {
      id: { value: id },
      idType: { value: idType },
      label: { value: label },
    } = this.getIdentityFields();
    if (!id || !idType) {
      return null;
    }
    return {
      id,
      idType: idType === 'Advertiser' ? IDType.ADVERTISER : IDType.PARTNER,
      label: label || `${idType} ${id}`,
      name: label,
    };
  }

  override displaySetupGuide() {
    this.migrate();
    const template = HtmlService.createTemplateFromFile('html/setup');
    template['id'] = HELPERS.getRangeByName(ENTITY_ID).getValue() || '';
    template['idType'] = HELPERS.getRangeByName(ID_TYPE).getValue() || '';
    template['dynamicFields'] = JSON.stringify(this.getIdentityFields());
    template['settings'] = this.getSettings();
    const htmlOutput = template.evaluate().setWidth(450).setHeight(600);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Set up');
    return template['id'];
  }
}
