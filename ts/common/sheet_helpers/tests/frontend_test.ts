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

import {
  FakePropertyStore,
  mockAppsScript,
} from '../../test_helpers/mock_apps_script.js';
import { RuleExecutorClass, RuleGetter } from '../../types.js';
import {
  FakeClient,
  FakeFrontend,
  Granularity,
  newRule,
  RuleRange,
  scaffoldSheetWithNamedRanges,
  TestClientTypes,
} from '../../tests/helpers.js';
import { equalTo } from '#common/checks.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('AppsScriptFrontend', function () {
  let frontend: FakeFrontend;
  const rules: Record<string, RuleExecutorClass<TestClientTypes>> = {};

  beforeEach(function () {
    const values = {
      '1': equalTo(42, 1, {}),
      '42': equalTo(42, 42, {}),
    };
    rules['ruleA'] = newRule({
      params: {},
      valueFormat: { label: 'Some Value' },
      name: 'Rule A',
      description: 'The rule for rule A',
      granularity: Granularity.DEFAULT,
      async callback() {
        return { values };
      },
    });
    rules['ruleB'] = newRule({
      params: {},
      valueFormat: { label: 'Some Value' },
      name: 'Rule B',
      description: 'The rule for rule B',
      granularity: Granularity.DEFAULT,
      async callback() {
        return { values };
      },
    });
    rules['ruleC'] = newRule({
      params: {},
      valueFormat: { label: 'Some Value' },
      name: 'No HTML',
      description: 'This <strong>is too much <em>HTML</em></strong>',
      granularity: Granularity.DEFAULT,
      async callback() {
        return { values };
      },
    });
    rules['ruleD'] = newRule({
      params: {},
      valueFormat: { label: 'Some Value' },
      name: 'Paragraphs',
      description: '<p>One line</p><p>Another line</p>',
      granularity: Granularity.DEFAULT,
      async callback() {
        return { values };
      },
    });
    mockAppsScript();
    frontend = FakeFrontend.withIdentity({
      ruleRangeClass: RuleRange,
      rules: Object.values(rules),
      version: '1.0',
      clientInitializer: () => new FakeClient('test', new FakePropertyStore()),
      migrations: [],
      properties: new FakePropertyStore(),
    });
  });

  describe('rule sheet', function () {
    it('loads rules fresh when empty', async function () {
      await frontend.initializeRules();
      const sheet = SpreadsheetApp.getActive().getSheetByName(
        'Enable/Disable Rules',
      );
      const values = sheet.getRange(1, 1, 3, 3).getValues();

      expect(values).toEqual([
        ['Rule Name', 'Description', 'Enabled'],
        ['Rule A', 'The rule for rule A', true],
        ['Rule B', 'The rule for rule B', true],
      ]);
    });

    it('strips non-paragraph HTML tags from descriptions', async function () {
      await frontend.initializeRules();
      const sheet = SpreadsheetApp.getActive().getSheetByName(
        'Enable/Disable Rules',
      );
      const values = sheet.getRange(4, 2, 1, 1).getValues();

      expect(values).toEqual([['This is too much HTML']]);
    });

    it('converts paragraph HTML tags to newlines', async function () {
      await frontend.initializeRules();
      const sheet = SpreadsheetApp.getActive().getSheetByName(
        'Enable/Disable Rules',
      );
      const values = sheet.getRange(5, 2, 1, 1).getValues();

      expect(values).toEqual([['One line\n\nAnother line']]);
    });

    it('returns an object of enabled / disabled rules', async function () {
      for (const rule of Object.values(rules)) {
        frontend.client.addRule(rule, [[''], ['']]);
      }
      const values = [
        ['Rule Name', 'Description', 'Enabled'],
        ['Rule A', 'The rule for rule A', true],
        ['Rule B', 'The rule for rule B', false],
        ['No HTML', 'The rule for rule A', true],
        ['Paragraphs', 'The rule for rule B', false],
      ];
      SpreadsheetApp.getActive()
        .insertSheet('Enable/Disable Rules')
        .getRange(1, 1, values.length, values[0].length)
        .setValues(values);

      const mapObject = frontend.setUpRuleSheet();

      expect(Object.fromEntries(mapObject)).toEqual({
        'Rule A': true,
        'Rule B': false,
        'No HTML': true,
        Paragraphs: false,
      });
    });

    it('has checkboxes in the correct rows', async function () {
      type Checkboxes = GoogleAppsScript.Spreadsheet.Spreadsheet & {
        checkboxes: Record<number, Record<number, boolean>>;
      };

      await frontend.initializeRules();
      const sheet = SpreadsheetApp.getActive().getSheetByName(
        'Enable/Disable Rules',
      ) as unknown as Checkboxes;

      expect(sheet.getRange('A1:A5').getValues().flat(1)).toEqual([
        'Rule Name',
        'Rule A',
        'Rule B',
        'No HTML',
        'Paragraphs',
      ]);
      expect(sheet.checkboxes).toEqual({
        1: { 2: true },
        2: { 2: true },
        3: { 2: true },
        4: { 2: true },
      });
    });
  });

  describe('Test emails', function () {
    let rules: Record<string, RuleGetter>;

    const email = (to: string) => ({
      to,
      subject: 'Anomalies found for test',
      body: `The following errors were found:

          ----------
          Rule A:
          ----------
          - v1
          - v3

          ----------
          Rule B:
          ----------
          - v5`.replace(/  +/g, ''),
    });

    beforeEach(function () {
      scaffoldSheetWithNamedRanges();
      rules = {
        keyA: {
          name: 'Rule A',
          values: {
            '1': {
              value: 'v1',
              anomalous: true,
              fields: {},
            },
            '2': {
              value: 'v2',
              anomalous: false,
              fields: {},
            },
            '3': {
              value: 'v3',
              anomalous: true,
              fields: {},
            },
          },
        },
        keyB: {
          name: 'Rule B',
          values: {
            '1': {
              value: 'v4',
              anomalous: false,
              fields: {},
            },
            '2': {
              value: 'v5',
              anomalous: true,
              fields: {},
            },
          },
        },
        keyC: {
          name: 'Rule C',
          values: {
            '1': {
              value: 'v6',
              anomalous: false,
              fields: {},
            },
            '2': {
              value: 'v7',
              anomalous: false,
              fields: {},
            },
          },
        },
      };
    });

    afterEach(function () {
      vi.restoreAllMocks();
    });

    it('sends anomalies to a user whenever they are new', function () {
      SpreadsheetApp.getActive()
        .getRangeByName('EMAIL_LIST')!
        .setValue('user@example.com');
      const messageExists: boolean[] = [];

      // Act
      frontend.maybeSendEmailAlert(rules);
      // Add messages
      messageExists.push(frontend.getMessages().length === 1);
      // One anomaly is resolved.
      const newRules = getNewRules(rules, 'keyB');
      frontend.maybeSendEmailAlert(newRules);
      messageExists.push(frontend.getMessages().length === 1);
      // The anomaly is back.
      frontend.maybeSendEmailAlert(rules);
      const messages = frontend.getMessages();
      messageExists.push(messages.length === 1);
      // Expected output shows the old anomaly is freshly alerted.
      const newEmail = email('user@example.com');
      newEmail.body = `The following errors were found:

      ----------
      Rule B:
      ----------
      - v5`.replace(/  +/g, '');

      // Assert
      expect(messageExists).toEqual([true, false, true]);
      expect(messages).toEqual([newEmail]);
    });
  });
});

/**
 * Replaces a current ruleset with a copy that lacks a given key.
 */
function getNewRules(rules: Record<string, RuleGetter>, keyToRemove: string) {
  const newRules = Object.assign({}, rules);
  delete newRules[keyToRemove];
  return newRules;
}
