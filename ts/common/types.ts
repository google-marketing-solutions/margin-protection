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
 * An interface for abstracting property storage, allowing for different
 * implementations (e.g., `PropertiesService` or a mock for testing).
 */
export interface PropertyStore {
  /** Sets a property with the given key and value. */
  setProperty(propertyName: string, value: string): void;
  /** Gets a property by its key. */
  getProperty(propertyName: string): string | null;
  /** Gets all properties as a record. */
  getProperties(): Record<string, string>;
}

/**
 * The resolved result of a rule's execution, containing all checked values.
 */
export interface ExecutorResult {
  /** A record of checked values, indexed by a unique key. */
  values: Values;
}

/**
 * The type for a rule's primary execution logic. It's a function that returns
 * a promise resolving to the `ExecutorResult`.
 * @template Params The parameter definitions for the rule.
 */
export type Callback<Params extends Record<keyof Params, ParamDefinition>> =
  () => Promise<ExecutorResult> & ThisType<Params>;

/**
 * An interface for a map-like object that stores rule settings on a per-ID
 * basis (e.g., by campaign ID), with a fallback to 'default' settings.
 * @template P A record type representing the parameters for a rule.
 */
export interface SettingMapInterface<
  P extends { [Property in keyof P]: P[keyof P] },
> {
  /**
   * Gets the settings for an ID, falling back to defaults for any unset
   * values.
   */
  getOrDefault(id: string): P;

  /**
   * Gets the explicit settings for an ID, returning blank strings if not found.
   */
  get(id: string): P;
  /** Sets the settings for a given ID. */
  set(id: string, value: P): void;
  /** Returns all entries as an array of [id, values] tuples. */
  entries(): ReadonlyArray<[string, string[]]>;
}

/**
 * A type alias for a `SettingMapInterface`, representing a matrix of settings
 * indexed by ID.
 * @template Params A record of parameter names to their values.
 */
export type Settings<Params> = SettingMapInterface<{
  [Property in keyof Params]: Params[keyof Params];
}>;

/**
 * The base interface for a client object, which wraps the API and manages rule
 * execution for a specific platform (e.g., DV360, SA360).
 * @template T The specific `ClientTypes` for the platform.
 */
export interface BaseClientInterface<T extends ClientTypes<T>> {
  /** The arguments used to initialize the client. */
  readonly args: T['clientArgs'];
  /** A store of all registered rule executors, indexed by name. */
  readonly ruleStore: {
    [ruleName: string]: RuleExecutor<T>;
  };
  /** The property store instance used by the client. */
  readonly properties: PropertyStore;
  /** Fetches all campaign-like entities for the client. */
  getAllCampaigns(): Promise<RecordInfo[]>;
  /** Validates all enabled rules and returns the results. */
  validate(): Promise<{
    rules: Record<string, RuleExecutor<T>>;
    results: Record<string, ExecutorResult>;
  }>;

  /** Adds a new rule executor to the client's rule store. */
  addRule<Params extends Record<keyof Params, ParamDefinition>>(
    rule: RuleExecutorClass<T, Params>,
    settingsArray: ReadonlyArray<string[]>,
  ): T['client'];
}

/**
 * Defines the structure for a single, user-configurable rule parameter.
 */
export interface ParamDefinition {
  /** The user-facing label for the parameter in the settings sheet. */
  label: string;
  /** An optional default value for the parameter. */
  defaultValue?: string;
  /** An optional array of Google Sheets data validation formulas. */
  validationFormulas?: string[];
  /** An optional number format string to apply to the parameter's column. */
  numberFormat?: string;
}

/**
 * A generic type representing the level at which a rule's settings can be
 * configured (e.g., 'Campaign', 'AdGroup').
 */
export type RuleGranularity<G extends RuleGranularity<G>> = {
  [Property in keyof G]: G;
};

/**
 * An interface for an instantiated, executable rule object.
 * @template T The specific `ClientTypes` for the platform.
 * @template P The parameter definitions for the rule.
 */
export interface RuleExecutor<
  T extends ClientTypes<T>,
  P extends DefinedParameters<P> = Record<string, ParamDefinition>,
> extends Omit<RuleDefinition<T, P>, 'callback' | 'defaults' | 'granularity'> {
  /** The client instance this rule is bound to. */
  client: T['client'];
  /** The settings for this rule instance. */
  settings: Settings<Record<keyof P, string>>;
  /** The function to run the rule's logic. */
  run: () => Promise<ExecutorResult>;
  /** An optional helper description for the rule. */
  helper: string;
  /** The granularity at which this rule operates. */
  granularity: T['ruleGranularity'];
  /** Whether the rule is currently enabled for execution. */
  enabled: boolean;
}

/**
 * A simple interface holding the name and description of a rule.
 */
export interface RuleInfo {
  name: string;
  description: string;
}
/**
 * An interface that merges basic rule information with its execution results.
 */
export interface RuleGetter {
  name: string;
  values: Values;
}

/**
 * Defines the complete, type-enforced structure for a new rule.
 * @template T The specific `ClientTypes` for the platform.
 * @template P The parameter definitions for the rule.
 */
export interface RuleDefinition<
  T extends ClientTypes<T>,
  P extends Record<keyof P, ParamDefinition>,
> extends RuleInfo {
  /** The core execution logic for the rule. */
  callback: Callback<P>;
  /** The level at which the rule is configured (e.g., 'Campaign'). */
  granularity: T['ruleGranularity'];
  /** A record defining the parameters this rule accepts. */
  params: { [Property in keyof P]: ParamDefinition };
  /** An optional helper string displayed in the settings sheet. */
  helper?: string;
  /** Defines the label and format for the 'value' column in results. */
  valueFormat: { label: string; numberFormat?: string };
}

/**
 * A standardized structure for basic information about an advertising entity
 * (e.g., a campaign, an insertion order).
 */
export interface RecordInfo {
  advertiserId: string;
  advertiserName?: string;
  id: string;
  displayName: string;
}

/**
 * A variation of `RecordInfo` for the new SA360 API, which uses customer IDs
 * instead of advertiser IDs.
 */
export interface RecordInfoV2 {
  customerId: string;
  id: string;
  displayName: string;
}

/**
 * The base interface for client-specific arguments.
 * @template ChildClass The extending class, for type safety.
 */
export interface BaseClientArgs<ChildClass extends BaseClientArgs<ChildClass>> {
  /**
   * A user-defined label for this client instance, used for identification in
   * emails and reports.
   */
  label: string;
}

/**
 * The base interface for a frontend wrapper.
 * @template T The specific `ClientTypes` for the platform.
 */
export interface Frontend<T extends ClientTypes<T>> {
  client: T['client'];
}

/**
 * A generic interface that bundles all the specific types for a given client
 * implementation (e.g., its client arguments, rule granularity, etc.).
 * @template T The specific `ClientTypes` for the platform.
 */
export interface ClientTypes<T extends ClientTypes<T>> {
  /** The interface of the client object. */
  client: BaseClientInterface<T>;
  /** The type defining the rule granularity options. */
  ruleGranularity: RuleGranularity<T['ruleGranularity']>;
  /** The interface for the client's initialization arguments. */
  clientArgs: BaseClientArgs<T['clientArgs']>;
  /** The interface for the frontend object. */
  frontend: Frontend<T>;
}

/**
 * An interface for a class constructor that can instantiate a `RuleExecutor`.
 * @template T The specific `ClientTypes` for the platform.
 * @template P The parameter definitions for the rule.
 */
export interface RuleExecutorClass<
  T extends ClientTypes<T>,
  P extends Record<keyof P, P[keyof P]> = Record<string, ParamDefinition>,
> {
  /**
   * The constructor for the rule executor.
   * @param client The client instance.
   * @param settings A 2D array of settings from the sheet.
   */
  new (
    client: T['client'],
    settings: ReadonlyArray<string[]>,
  ): RuleExecutor<T, P>;
  /** The static definition of the rule. */
  definition: RuleDefinition<T, P>;
}

/**
 * An interface representing an entry in the rule store, containing the rule's
 * class and its settings.
 * @template T The specific `ClientTypes` for the platform.
 * @template P The parameter definitions for the rule.
 */
export interface RuleStoreEntry<
  T extends ClientTypes<T>,
  P extends Record<
    keyof ParamDefinition,
    ParamDefinition[keyof ParamDefinition]
  >,
> {
  /**
   * The constructor for the rule executor class.
   */
  rule: RuleExecutorClass<T>;

  /**
   * The settings for the rule, indexed by entity ID and parameter key.
   */
  settings: Settings<P>;
}

/**
 * An interface for a class that manages the reading and writing of rule
 * settings to and from a Google Sheet.
 * @template T The specific `ClientTypes` for the platform.
 */
export interface RuleRangeInterface<T extends ClientTypes<T>> {
  /** Sets a single row of settings for a given category and ID. */
  setRow(category: string, campaignId: string, column: string[]): void;

  /**
   * Reconstructs and returns the entire 2D array for the settings sheet.
   * @param ruleGranularity An optional filter for a specific granularity.
   */
  getValues(ruleGranularity?: T['ruleGranularity']): string[][];

  /** Gets the settings for a single, specific rule. */
  getRule(ruleName: string): string[][];
  /** Populates the sheet with the entities and parameters for a given rule. */
  fillRuleValues<Params>(
    rule: Pick<
      RuleDefinition<T, Record<keyof Params, ParamDefinition>>,
      'name' | 'params' | 'granularity'
    >,
  ): Promise<void>;
  /** Gets all relevant entity rows for a given granularity. */
  getRows(granularity: T['ruleGranularity']): Promise<RecordInfo[]>;

  /**
   * Writes the current state of the rule settings back to the spreadsheet.
   */
  writeBack(granularity: T['ruleGranularity']): void;
}

/**
 * Defines the arguments required to initialize a frontend instance.
 * @template T The specific `ClientTypes` for the platform.
 */
export interface FrontendArgs<T extends ClientTypes<T>> {
  /** The constructor for the `RuleRange` class to be used. */
  readonly ruleRangeClass: {
    new (sheet: string[][], client: T['client']): RuleRangeInterface<T>;
  };
  /** An array of all rule classes to be registered with the client. */
  readonly rules: ReadonlyArray<RuleExecutorClass<T>>;
  /** A function that initializes the client instance. */
  readonly clientInitializer: (
    clientArgs: T['clientArgs'],
    properties: PropertyStore,
  ) => T['client'];
  /** The current version of the application, used for migrations. */
  readonly version: string;
  /** A record of migration functions, indexed by version string. */
  readonly migrations: Record<string, (frontend: T['frontend']) => void>;
  /** The property store instance to be used. */
  readonly properties: PropertyStore;
}

/**
 * Defines the interface for a frontend object.
 * @template T The specific `ClientTypes` for the platform.
 */
export interface FrontendInterface<T extends ClientTypes<T>> {
  client: T['client'];
}

/**
 * A type alias for a rule's parameters, including the `ThisType` definition
 * for the rule's callback function.
 * @template T The specific `ClientTypes` for the platform.
 * @template P The parameter definitions for the rule.
 */
export type RuleParams<
  T extends ClientTypes<T>,
  P extends Record<keyof P, ParamDefinition>,
> = RuleDefinition<T, P> & ThisType<RuleExecutor<T, P>>;

/**
 * A type defining the names of the main Apps Script functions that serve as
 * entry points from the UI or triggers.
 */
export type AppsScriptFunctions =
  | 'onOpen'
  | 'initializeSheets'
  | 'preLaunchQa'
  | 'launchMonitor'
  | 'displaySetupGuide'
  | 'displayGlossary';

/**
 * Represents a collection of checked values, indexed by a unique key.
 */
export interface Values {
  [key: string]: Value;
}

/**
 * Represents the result of a single check on a value.
 */
export interface Value {
  /** The original value that was checked. */
  value: Readonly<string>;
  /** A boolean indicating whether the value is considered anomalous. */
  anomalous: Readonly<boolean>;
  /** An optional timestamp of when an alert was last sent for this value. */
  alertedAt?: Readonly<number>;
  /** A record of the fields that identify this specific value. */
  fields: Readonly<{ [key: string]: string }>;
}

/**
 * A type for a check function, which performs a validation and returns a
 * `Value` object.
 */
export type Check = (
  // Keeping this value flexible. Child functions will implement type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  test: any,
  // Keeping this value flexible. Child functions will implement type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
  fields: { [key: string]: string },
) => Value;

/**
 * A utility type that enforces a record of named `ParamDefinition` objects.
 * @template P A record where keys are parameter names.
 */
export type DefinedParameters<P> = Record<keyof P, ParamDefinition>;
