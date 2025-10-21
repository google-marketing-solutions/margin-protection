# CM360 Rule Example: Placements Without Ads

This guide demonstrates how to create a custom rule to monitor for a common trafficking issue in Campaign Manager 360 (CM360): active placements that do not have any ads assigned to them.

**Goal:** Alert the user if an active placement is found without any ad rotations, as this will prevent the placement from serving impressions.

## Step 1: Define the Rule in `ts/common/types.ts`

This rule is a simple check and doesn't require any configuration parameters from the user in the sheet.

```typescript
// In ts/common/types.ts

export type Rule =
  // ... other rules
  | {type: 'cm360_placements_missing_ads'};
```

## Step 2: Implement the Rule Logic in `ts/cm360/src/rules.ts`

This logic is specific to CM360. The CM360 API provides placement and ad data. We'll assume the API fetching logic links ads to their parent placements.

```typescript
// In a new file ts/cm360/src/rules.ts or an existing one

import {Placement} from './types'; // Assuming a type definition for CM360 placements
import {CheckResult} from '../../common/types';

/**
 * Checks if an active CM360 placement has any ads assigned.
 * @param {Placement} placement The placement to check.
 * @return {CheckResult} The result of the check.
 */
export function checkPlacementHasAds(placement: Placement): CheckResult {
  // We only care about active placements that are scheduled to be serving.
  const now = new Date();
  const endDate = new Date(placement.endDate);
  if (placement.status !== 'ACTIVE' || now > endDate) {
    return {isViolation: false};
  }

  // Check if the ads array is empty or missing.
  if (!placement.assignedAds || placement.assignedAds.length === 0) {
    return {
      isViolation: true,
      message: `Placement "${placement.name}" in Campaign "${placement.campaignName}" is active but has no ads assigned.`,
    };
  }

  return {isViolation: false};
}
```

## Step 3: Integrate the Rule in `ts/cm360/src/main.ts`

We call our new function from the main execution loop.

```typescript
// In ts/cm360/src/main.ts

// Assuming `placements` and `rules` are fetched
for (const rule of rules) {
  if (rule.type === 'cm360_placements_missing_ads') {
    for (const placement of placements) {
      const result = checkPlacementHasAds(placement);
      if (result.isViolation) {
        violations.push(result);
      }
    }
  }
}
```

## Step 4: Add a Unit Test in `ts/cm360/src/tests/rules_test.ts`

We write a test to verify the logic.

```typescript
// In ts/cm360/src/tests/rules_test.ts

it('should flag an active placement with no ads', () => {
  const placement = {
    name: 'Test Placement',
    campaignName: 'Test Campaign',
    status: 'ACTIVE',
    endDate: new Date(Date.now() + 86400000).toISOString(), // tomorrow
    assignedAds: [],
  };

  const result = checkPlacementHasAds(placement);
  expect(result.isViolation).toBeTruthy();
});

it('should not flag an inactive placement with no ads', () => {
  const placement = {
    name: 'Test Placement',
    campaignName: 'Test Campaign',
    status: 'INACTIVE',
    endDate: new Date(Date.now() + 86400000).toISOString(),
    assignedAds: [],
  };

  const result = checkPlacementHasAds(placement);
  expect(result.isViolation).toBeFalsy();
});
```
