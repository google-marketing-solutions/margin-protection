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

import 'jasmine';

import * as absoluteRule from 'anomaly_library/absoluteRule';
import {Rule, sendEmailAlert, ThresholdRuleInstructions} from 'anomaly_library/main';
import {FakePropertyStore, getEmails, mockAppsScript} from 'anomaly_library/testing/mock_apps_script';

type Method<ThresholdType> = (instructions: ThresholdRuleInstructions<ThresholdType>) => Rule;

describe('Anomaly checks on number thresholds', () => {
  const propertyStore = new FakePropertyStore();

  beforeEach(() => {
    mockAppsScript();
  });
  const equalityRules: Array<{method: Method<number>, values: boolean[]}> = [
    {method: absoluteRule.equalTo, values: [false, true, false]},
    {method: absoluteRule.notEqualTo, values: [true, false, true]},
    {method: absoluteRule.lessThanOrEqualTo, values: [true, true, false]},
    {method: absoluteRule.lessThan, values: [true, false, false]},
    {method: absoluteRule.greaterThanOrEqualTo, values: [false, true, true]},
    {method: absoluteRule.greaterThan, values: [false, false, true]},
  ];
  for (const {method, values} of equalityRules) {
    describe(`For the rule absoluteRule.${method.name}`, () => {
      for (let i = 0; i < 3; i++) {
        it(`${i} ${values[i] ? 'passes': 'fails'}`, () => {
          expect(
              method({
                uniqueKey: 'num',
                thresholdValue: 1,
                propertyStore,
              }).valueIsInBounds(i.toString()))
              .toEqual(values[i]);
        });
      }
    });
  }
});

describe('When we save values', () => {
  const propertyStore = new FakePropertyStore();
  let i = 0;
  function fakeApiCall() {
    return ++i;
  }

  beforeEach(() => {
    mockAppsScript();
  });

  afterEach(() => {
    FakePropertyStore.clearCache();
  });

  it('has the value stored in the property service', () => {
    const equalTo = absoluteRule.equalTo({uniqueKey: 'num', thresholdValue: 2, propertyStore});
    equalTo.saveValues({'5': equalTo.createValue(fakeApiCall())});
    expect(equalTo.getValues()).toEqual([
      {value: '1', anomalous: true},
    ]);
  });


  it('sends nothing if there are no alerts', () => {
    expect(getEmails()).toEqual([]);
    const equalTo = absoluteRule.equalTo({uniqueKey: 'num', thresholdValue: 1, propertyStore});
    equalTo.getValues();
    // email 1 - this should be blank
    sendEmailAlert([equalTo], {
      to: 'me1@example.com',
      subject: 'Alerts',
    });

    expect(getEmails()).toEqual([]);
  });

  it('only sends one alert when >1 calls', () => {
    const equalTo = absoluteRule.equalTo({uniqueKey: 'num', thresholdValue: 1, propertyStore});
    equalTo.saveValues({'1': equalTo.createValue(2)});
    // email 1 - this one will have data
    sendEmailAlert([equalTo], {
      to: 'me1@example.com',
      subject: 'Alerts',
    });

    // email 2 - this one should be blank
    sendEmailAlert([equalTo], {
      to: 'me2@example.com',
      subject: 'Alerts',
    });

    const emails = getEmails();
    expect(emails.length).toEqual(2);
  });
});
