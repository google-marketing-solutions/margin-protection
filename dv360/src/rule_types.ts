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

interface BudgetPacing {
  startDate: Readonly<Date>;
  endDate: Readonly<Date>;
  spend: Readonly<number>;
  budget: Readonly<number>;
}

/**
 * Return type used to determine days ahead pacing.
 */
export interface InsertionOrderDaysAhead extends BudgetPacing {
  days: Readonly<number>;
}

/**
 * Return type used to determine percent ahead pacing.
 */
export interface InsertionOrderPercentAhead extends BudgetPacing {
  percent: Readonly<number>;
}
