# DV360 Rule Example: Flight Pacing

This guide demonstrates how to create a custom rule to monitor the budget pacing of a Display & Video 360 (DV360) insertion order relative to its flight dates.

**Goal:** Alert the user if an insertion order has spent more than expected given how much time has passed in its flight.

## Step 1: Define the Rule in `ts/common/types.ts`

First, we define the shape of our new rule. It needs a `pacingThreshold` to determine how far ahead of schedule spending can be before an alert is triggered (e.g., 1.1 for 10% ahead).

```typescript
// In ts/common/types.ts

export type Rule =
  // ... other rules
  | {type: 'dv360_flight_pacing'; pacingThreshold: number};
```

## Step 2: Implement the Rule Logic in `ts/dv360/src/rules.ts`

Since this rule is specific to DV360 data (insertion orders have "flights"), we'll add the logic in the `ts/dv360/` directory.

```typescript
// In a new file ts/dv360/src/rules.ts or an existing one

import {InsertionOrder} from './dv360_types';
import {CheckResult} from '../../common/types';

/**
 * Checks if a DV360 insertion order is pacing ahead of schedule.
 * @param {InsertionOrder} insertionOrder The insertion order to check.
 * @param {number} pacingThreshold The allowed pacing buffer (e.g., 1.1 for 10%).
 * @return {CheckResult} The result of the check.
 */
export function checkFlightPacing(
  insertionOrder: InsertionOrder,
  pacingThreshold: number,
): CheckResult {
  const now = new Date();
  const startDate = new Date(insertionOrder.flightStartDate);
  const endDate = new Date(insertionOrder.flightEndDate);

  if (now > endDate) {
    return {isViolation: false}; // Flight is over, no longer pacing.
  }

  const totalFlightDuration = endDate.getTime() - startDate.getTime();
  const elapsedDuration = now.getTime() - startDate.getTime();

  if (elapsedDuration <= 0) {
    return {isViolation: false}; // Flight hasn't started.
  }

  const expectedSpendPercentage = elapsedDuration / totalFlightDuration;
  const actualSpendPercentage = insertionOrder.spend / insertionOrder.budget;

  const currentPacing = actualSpendPercentage / expectedSpendPercentage;

  if (currentPacing > pacingThreshold) {
    return {
      isViolation: true,
      message: `Insertion Order "${insertionOrder.name}" is pacing at ${(
        currentPacing * 100
      ).toFixed(
        0,
      )}% of expected, which is over the threshold of ${pacingThreshold * 100}%.`,
    };
  }

  return {isViolation: false};
}
```

## Step 3: Integrate the Rule in `ts/dv360/src/main.ts`

Now, we call our new function from the main execution loop when a rule of our new type is encountered.

```typescript
// In ts/dv360/src/main.ts (or equivalent main check function)

// Assuming `insertionOrders` and `rules` are fetched
for (const rule of rules) {
  if (rule.type === 'dv360_flight_pacing') {
    for (const io of insertionOrders) {
      const result = checkFlightPacing(io, rule.pacingThreshold);
      if (result.isViolation) {
        violations.push(result);
      }
    }
  }
}
```

## Step 4: Add a Unit Test in `ts/dv360/src/tests/rules_test.ts`

Finally, we write a test to ensure our logic is correct.

```typescript
// In ts/dv360/src/tests/rules_test.ts

it('should flag an insertion order that is pacing too fast', () => {
  const today = new Date();
  const startDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
  const endDate = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

  const insertionOrder = {
    name: 'Pacing IO Test',
    spend: 750, // 75% spent
    budget: 1000,
    flightStartDate: startDate.toISOString(),
    flightEndDate: endDate.toISOString(),
  };

  // Expected spend is 50% (5 out of 10 days have passed).
  // Actual spend is 75%. Pacing is 75/50 = 1.5 or 150%.
  const result = checkFlightPacing(insertionOrder, 1.1); // Threshold is 110%
  expect(result.isViolation).to.be.true;
});
```
