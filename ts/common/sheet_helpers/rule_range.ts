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
  ClientTypes,
  ParamDefinition,
  RecordInfo,
  RuleDefinition,
  RuleRangeInterface,
} from 'common/types';
import { HEADER_RULE_NAME_INDEX, SHEET_TOP_PADDING } from './constants';
import { HELPERS } from './helpers';
import { makeCampaignIndexedSettings } from './setting_map';

/**
 * Rule split according to the name of the rule in a dictionary.
 *
 * The range has two headers: Header 1 is category/rule names, and
 * header 2 is the name of the rule setting to be changed.
 */
export abstract class AbstractRuleRange<T extends ClientTypes<T>>
  implements RuleRangeInterface<T>
{
  private rowIndex: Record<string, number> = {};
  private readonly columnOrders: Record<string, Record<string, number>> = {};
  private readonly rules: Record<string, string[][]> &
    Record<'none', string[][]> = { none: [[]] };
  private length = 0;

  constructor(
    range: string[][],
    protected readonly client: T['client'],
    constantHeaders: string[] = ['ID', 'default'],
  ) {
    for (let i = 0; i < constantHeaders.length; i++) {
      this.rowIndex[constantHeaders[i]] = i;
    }
    this.length = Object.keys(this.rowIndex).length;
    this.setRules(range);
  }

  setRow(category: string, id: string, column: string[]): void {
    if (id === '') {
      return;
    }
    if (this.rowIndex[id] === undefined) {
      this.rowIndex[id] = ++this.length;
    }
    (this.rules[category] = this.rules[category] || [])[this.rowIndex[id]] =
      column;
  }

  getValues(ruleGranularity?: T['ruleGranularity']): string[][] {
    const newRowIndex = { ...this.rowIndex };

    const values = Object.entries(this.rules).reduce(
      (combinedRuleRange, [category, rangeRaw]) => {
        const range = rangeRaw.filter((row) => row && row.length);
        const defaultFirstColumns = Array.from<string>({
          length: range[0] ? range[0].length : 0,
        }).fill('');
        if (
          ruleGranularity &&
          this.client.ruleStore[category] &&
          category !== 'none' &&
          this.client.ruleStore[category].granularity !== ruleGranularity
        ) {
          return combinedRuleRange;
        }
        const ruleSettingColumnCount = range.length
          ? range[HEADER_RULE_NAME_INDEX].length
          : 0;
        if (!ruleSettingColumnCount) {
          return combinedRuleRange;
        }
        const ruleSettingColumnOffset = combinedRuleRange[0].length;
        combinedRuleRange[0] = combinedRuleRange[0].concat(
          Array.from({ length: ruleSettingColumnCount }).fill(
            category === 'none' ? '' : category,
          ) as string[],
        );

        combinedRuleRange[1] =
          category === 'none'
            ? defaultFirstColumns
            : combinedRuleRange[1].concat(
                Array.from<string>({ length: ruleSettingColumnCount })
                  .fill('')
                  .map((_cell, idx) => {
                    if (
                      idx === 0 &&
                      this.client.ruleStore[
                        combinedRuleRange[0][idx + ruleSettingColumnOffset]
                      ]
                    ) {
                      return this.client.ruleStore[
                        combinedRuleRange[0][idx + ruleSettingColumnOffset]
                      ].helper;
                    } else {
                      return '';
                    }
                  }),
              );
        // Using the default row order can lead to some weird things like the
        // header coming in at the end of the list if {'a': 2, 'b': 1}.
        // Below `rowIndex` is sorted and reorganized. The resulting range
        // will reflect the correct `rowIndex` so that order is never
        // incorrect.
        type IndexEntry = [entityId: string, currentPosition: number];
        const indexEntries: IndexEntry[] = Object.entries<number>(
          this.rowIndex,
        );
        const sortedEntries = indexEntries.sort(
          (firstVal: IndexEntry, secondVal: IndexEntry) =>
            firstVal[1] - secondVal[1],
        );
        sortedEntries.forEach(
          ([entityId, currentOrdinalValue], postSortedOrdinalValue) => {
            const offsetRow = postSortedOrdinalValue + SHEET_TOP_PADDING;
            combinedRuleRange[offsetRow] = (combinedRuleRange[offsetRow] =
              combinedRuleRange[offsetRow] || []).concat(
              rangeRaw[currentOrdinalValue] ??
                Array.from<string>({ length: ruleSettingColumnCount }).fill(''),
            );
            newRowIndex[entityId] = offsetRow;
          },
        );
        return combinedRuleRange;
      },
      [[], []] as string[][],
    );

    for (let c = values[0].length - 1; c > 0; c--) {
      values[0][c] = values[0][c - 1] === values[0][c] ? '' : values[0][c];
    }

    this.rowIndex = newRowIndex;
    return values;
  }

  getRule(ruleName: string): string[][] {
    if (!this.rules[ruleName] || !this.rules[ruleName].length) {
      return [];
    }
    return Object.values(this.rowIndex)
      .filter(
        (index) =>
          this.rules['none'][index] !== undefined &&
          this.rules[ruleName][index] !== undefined,
      )
      .sort((a, b) => a - b)
      .map((index) => {
        return [this.rules['none'][index][0], ...this.rules[ruleName][index]];
      });
  }

  /**
   * Available for testing.
   */
  setRule(ruleName: string, ruleValues: string[][]) {
    for (let r = 0; r < ruleValues.length; r++) {
      this.setRow(ruleName, ruleValues[r][0], ruleValues[r].slice(1));
    }
  }

  setRules(range: string[][]) {
    let start = 0;
    let col = 0;
    const thresholds: Array<[number, number]> = [];
    if (!range[0]) {
      return;
    }
    for (col = 0; col < range[0].length; col++) {
      if (range[0][col]) {
        thresholds.push([start, col]);
        start = col;
      }
    }
    if (start !== col) {
      thresholds.push([start, col]);
    }
    for (let r = 0; r < range.length; r++) {
      for (const [start, end] of thresholds) {
        this.setRow(
          range[0][start] || 'none',
          range[r][0],
          range[r].slice(start, end),
        );
      }
    }
  }

  async fillRuleValues<Params>(
    rule: Pick<
      RuleDefinition<T, Record<keyof Params, ParamDefinition>>,
      'name' | 'params' | 'granularity'
    >,
  ) {
    const headersByIndex: { [index: number]: string } = {};
    const paramsByHeader: { [index: string]: keyof Params } = {};
    const indexByHeader: { [header: string]: number } = {};
    Object.entries<ParamDefinition>(rule.params).forEach(
      ([key, { label }], index) => {
        headersByIndex[index] = label;
        paramsByHeader[label] = key as keyof Params;
        indexByHeader[label] = index;
      },
    );
    this.columnOrders[rule.name] =
      this.columnOrders[rule.name] || indexByHeader;
    const ruleValues = this.getRule(rule.name);
    const currentSettings = makeCampaignIndexedSettings(
      ruleValues[0] ? ruleValues[0].slice(1) : [],
      ruleValues,
    );
    const length = Object.keys(rule.params).length;

    const headers = await this.getRuleHeaders();
    this.setRow('none', 'ID', ['ID', `${rule.granularity} Name`, ...headers]);
    this.setRow(rule.name, 'ID', [...Object.values(headersByIndex)]);
    this.setRow('none', 'default', [
      'default',
      '',
      ...Array.from<string>({ length: headers.length }).fill(''),
    ]);
    this.setRow(
      rule.name,
      'default',
      Array.from({ length }).map(
        (_, index) =>
          (currentSettings.default
            ? currentSettings.default[headersByIndex[index]]
            : null) ??
          rule.params[paramsByHeader[headersByIndex[index]]].defaultValue ??
          '',
      ),
    );
    for (const record of await this.getRows(rule.granularity)) {
      this.setRow(
        rule.name,
        record.id,
        Array.from({ length }).map((unused, index) =>
          currentSettings && currentSettings[record.id]
            ? (currentSettings[record.id][headersByIndex[index]] ?? '')
            : '',
        ),
      );
      this.setRow('none', record.id, [
        record.id,
        record.displayName,
        ...((await this.getRuleMetadata(rule.granularity, record.id)) ?? []),
      ]);
    }
  }

  abstract getRuleMetadata(
    granularity: T['ruleGranularity'],
    id: string,
  ): Promise<string[]>;

  async getRuleHeaders(): Promise<string[]> {
    return [];
  }

  writeBack(ruleGranularity: T['ruleGranularity']) {
    const values = this.getValues(ruleGranularity);
    const range = HELPERS.getOrCreateSheet(
      `Rule Settings - ${ruleGranularity}`,
    ).getRange(1, 1, values.length, values[0].length);
    range.setValues(
      values.map((row) => row.map((cell) => (cell === '' ? '-' : cell))),
    );
    console.log('done');
  }

  abstract getRows(granularity: T['ruleGranularity']): Promise<RecordInfo[]>;
}
