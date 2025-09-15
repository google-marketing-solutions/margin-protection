/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview This file provides a collection of utility classes and helper
 * objects used throughout the DV360 API library, including tools for building
 * API filters, modifying URIs, and working with objects.
 */

/**
 * Defines the logical grouping operators for filter expressions.
 */
export enum FilterGrouping {
  AND = ' AND ',
  OR = ' OR ',
}

/**
 * Defines the supported equality operators for filter rules.
 */
export enum RuleOperator {
  EQ = '=',
  GTEQ = '>=',
  LTEQ = '<=',
}

/**
 * Represents a single filter rule to be used in a `FilterExpression`.
 */
export class Rule {
  /**
   * @param field The API field to apply the filter rule to.
   * @param operator The equality operator to use.
   * @param value The value to filter for.
   */
  constructor(
    private readonly field: string,
    private readonly operator: RuleOperator,
    private readonly value: string | number,
  ) {}

  /**
   * Returns the field name of the rule.
   * @return The field name.
   */
  getField(): string {
    return this.field;
  }

  /**
   * Returns the operator of the rule.
   * @return The rule operator.
   */
  getOperator(): RuleOperator {
    return this.operator;
  }

  /**
   * Returns the value of the rule.
   * @return The rule value.
   */
  getValue(): string | number {
    return this.value;
  }

  /**
   * Returns a string representation of the rule in API query format.
   * @return The string representation of the rule.
   */
  toString(): string {
    const val = this.getValue();
    const valString = typeof val === `string` ? `"${val}"` : val;
    return `${this.getField()}${this.getOperator()}${valString}`;
  }
}

/**
 * Represents a filter expression that can be applied when listing API entities
 * to filter results.
 */
export class FilterExpression {
  /**
   * @param rules An array of `Rule` objects to apply.
   * @param grouping The logical grouping for the rules. Defaults to AND.
   */
  constructor(
    private readonly rules: Rule[],
    private readonly grouping: FilterGrouping = FilterGrouping.AND,
  ) {}

  /**
   * Converts the filter expression into a URL-encoded string suitable for use
   * in an API request's 'filter' query parameter.
   *
   * @return The API-ready filter string.
   */
  toApiQueryString(): string {
    const queryString = this.rules
      .map((rule) => rule.toString())
      .join(this.grouping);
    return encodeURIComponent(queryString);
  }
}

/**
 * Defines the common parameters for API `list` methods.
 */
export interface ListParams {
  /** An optional filter expression to apply to the list request. */
  filter?: FilterExpression | null;
  /** The maximum number of results to return per page. */
  pageSize?: number;
  /** A field to order the results by. */
  orderBy?: string;
}

/** A utility object for working with URIs. */
// tslint:disable-next-line:enforce-name-casing Legacy from JS migration
export const UriUtil = {
  /**
   * Modifies a URL by appending a new query parameter or replacing the value of
   * an existing one.
   *
   * @param url The URL to modify.
   * @param key The query parameter key.
   * @param value The query parameter value.
   * @return The modified URL.
   */
  modifyUrlQueryString(url: string, key: string, value: string): string {
    let baseUrl: string;
    let queryString: string;
    let fragment: string;

    if (url.indexOf('?') !== -1) {
      [baseUrl, queryString] = url.split('?');
      fragment =
        queryString.indexOf('#') !== -1
          ? queryString.substring(queryString.indexOf('#'))
          : '';
      queryString = queryString.replace(fragment, '');
      const regExp = new RegExp(`(^|&)${key}=[^&]*`, 'g');
      const matches = queryString.match(regExp);

      if (matches) {
        let modified = false;

        matches.forEach((match) => {
          let replacement = '';

          if (!modified) {
            const val = match.substring(match.indexOf('=') + 1);
            replacement = match.replace(val, value);
            modified = true;
          }
          queryString = queryString.replace(match, replacement);
        });
      } else {
        const separator = queryString.length > 0 ? '&' : '';
        queryString += `${separator}${key}=${value}`;
      }
    } else {
      baseUrl = url;
      queryString = `${key}=${value}`;
      fragment = '';
    }
    return `${baseUrl}?${queryString}${fragment}`;
  },
};

/**
 * A utility object for working with JavaScript objects.
 */
// tslint:disable-next-line:enforce-name-casing legacy from JS migration
export const ObjectUtil = {
  /**
   * Extends a target object with the properties of a source object.
   *
   * @param original The original object to extend.
   * @param extension The object with properties to add.
   * @return The extended object.
   */
  extend<T extends object | null, E extends object>(
    original: T,
    extension: E,
  ): T & E {
    if (original == null) {
      return { ...extension } as T & E;
    }
    for (const key in extension) {
      if (extension.hasOwnProperty(key)) {
        const extensionValue = extension[key];
        const originalValue = (original as Record<string, string | string[]>)[
          key
        ];
        if (Array.isArray(extensionValue) && Array.isArray(originalValue)) {
          originalValue.push(...extensionValue);
        } else {
          (original as Record<string, E[keyof E]>)[key] = extension[key];
        }
      }
    }
    return original as T & E;
  },

  /**
   * Logs an error message to the console and throws a new `Error`.
   * @param msg The error message.
   * @return The new `Error` object.
   */
  error(msg: string) {
    // Apps Script is hiding thrown error messages, so we double up here.
    console.error(msg);
    return new Error(msg);
  },

  /**
   * Checks if a given object has a set of required properties and/or at least
   * one of a set of optional properties.
   *
   * @param obj The object to check.
   * @param options An object defining the properties to check for.
   * @param options.requiredProperties An array of property names that must
   *     exist.
   * @param options.oneOf An array of property names where at least one must
   *     exist.
   * @param options.errorOnFail If true, throws an error on failure instead of
   *     returning false.
   * @return True if the object satisfies the property checks, false otherwise.
   * @throws If `errorOnFail` is true and a check fails.
   */
  hasOwnProperties(
    obj: unknown,
    {
      requiredProperties = [],
      oneOf = [],
      errorOnFail = false,
    }: {
      requiredProperties?: string[];
      oneOf?: string[];
      errorOnFail?: boolean;
    },
  ): boolean {
    const keys = ObjectUtil.isObject(obj)
      ? Object.keys(obj as { [key: string]: unknown })
      : [];
    const result =
      keys.length > 0 &&
      (requiredProperties.length > 0 || oneOf.length > 0) &&
      requiredProperties.every((key) => keys.includes(key)) &&
      (oneOf.length === 0 || oneOf.some((key) => keys.includes(key)));
    if (errorOnFail) {
      const missingRequiredProperties = requiredProperties.filter(
        (key) => !keys.includes(key),
      );
      if (requiredProperties.length + oneOf.length === 0) {
        throw ObjectUtil.error(`No properties checked.`);
      }
      if (requiredProperties.length && missingRequiredProperties.length) {
        throw ObjectUtil.error(
          `Missing required properties: ${missingRequiredProperties.join(
            ', ',
          )}`,
        );
      }
      const missingOneOf = oneOf.filter((key) => !keys.includes(key));
      if (oneOf.length > 0 && missingOneOf.length > 1) {
        throw ObjectUtil.error(
          `Expected one "oneOf" property. Got ${missingOneOf.join(', ')}`,
        );
      }
    }
    return result;
  },

  /**
   * Checks if a given value is a non-array object.
   *
   * @param obj The value to check.
   * @return True if the value is an object, false otherwise.
   */
  isObject(obj: unknown): boolean {
    return obj != null && obj instanceof Object && !Array.isArray(obj);
  },
};
