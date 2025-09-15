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
 * A base interface for budget pacing calculations, containing common properties
 * for a given flight or budget segment.
 */
interface BudgetPacing {
  /** The start date of the flight or budget segment. */
  startDate: Readonly<Date>;
  /** The end date of the flight or budget segment. */
  endDate: Readonly<Date>;
  /** The amount spent during the period. */
  spend: Readonly<number>;
  /** The total budget for the period. */
  budget: Readonly<number>;
}

/**
 * The return type for a rule that calculates budget pacing in terms of days
 * ahead or behind schedule.
 */
export interface InsertionOrderDaysAhead extends BudgetPacing {
  /** The number of days the flight is ahead (positive) or behind (negative). */
  days: Readonly<number>;
}

/**
 * The return type for a rule that calculates budget pacing as a percentage
 * ahead or behind schedule.
 */
export interface InsertionOrderPercentAhead extends BudgetPacing {
  /** The percentage the flight is ahead (positive) or behind (negative). */
  percent: Readonly<number>;
}

/**
 * The return type for a rule that calculates the effective daily budget.
 */
export interface DailyBudget {
  /** The calculated daily budget. */
  dailyBudget: Readonly<number>;
  /** The total duration of the flight in days. */
  flightDurationDays: Readonly<number>;
  /** The total budget for the flight. */
  budget: Readonly<number>;
}
