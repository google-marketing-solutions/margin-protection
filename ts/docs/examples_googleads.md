# Google Ads Rule Example: Audience CPA

This guide demonstrates how to create a custom rule to monitor the Cost Per Acquisition (CPA) for a specific audience in a Google Ads campaign.

**Goal:** Alert the user if the CPA for a high-value audience (e.g., "cart abandoners") exceeds a certain threshold in a specific campaign.

## Step 1: Define the Rule in `ts/common/types.ts`

This rule needs to know the `campaignName`, the `audienceName`, and the `maxCpa`.

```typescript
// In ts/common/types.ts

export type Rule =
  // ... other rules
  | {
      type: 'googleads_audience_cpa';
      campaignName: string;
      audienceName: string;
      maxCpa: number;
    };
```

## Step 2: Implement the Rule Logic in `ts/googleads/src/rules.ts`

The Google Ads API allows fetching performance data segmented by audience. We'll create a function to check this data.

```typescript
// In a new file ts/googleads/src/rules.ts or an existing one

import {AudiencePerformance} from './types'; // A type for audience performance data
import {CheckResult} from '../../common/types';

/**
 * Checks if a specific audience's CPA is too high in a campaign.
 * @param {AudiencePerformance} audiencePerf The performance data for the audience.
 * @param {string} campaignName The name of the campaign to check.
 * @param {string} audienceName The name of the audience to check.
 * @param {number} maxCpa The maximum allowed CPA.
 * @return {CheckResult} The result of the check.
 */
export function checkAudienceCpa(
  audiencePerf: AudiencePerformance,
  campaignName: string,
  audienceName: string,
  maxCpa: number,
): CheckResult {
  // Check if this is the correct campaign and audience
  if (
    audiencePerf.campaignName !== campaignName ||
    audiencePerf.audienceName !== audienceName
  ) {
    return {isViolation: false};
  }

  // Calculate CPA (Cost / Conversions)
  if (audiencePerf.conversions === 0) {
    return {isViolation: false}; // No conversions yet, can't calculate CPA.
  }
  const cpa = audiencePerf.cost / audiencePerf.conversions;

  if (cpa > maxCpa) {
    return {
      isViolation: true,
      message: `Audience "${audienceName}" in Campaign "${campaignName}" has a CPA of $${cpa.toFixed(
        2,
      )}, which is above the threshold of $${maxCpa}.`,
    };
  }

  return {isViolation: false};
}
```

## Step 3: Integrate the Rule in `ts/googleads/src/main.ts`

We call our new function from the main execution loop.

```typescript
// In ts/googleads/src/main.ts

// Assuming `audiencePerformanceData` and `rules` are fetched
for (const rule of rules) {
  if (rule.type === 'googleads_audience_cpa') {
    for (const perf of audiencePerformanceData) {
      const result = checkAudienceCpa(
        perf,
        rule.campaignName,
        rule.audienceName,
        rule.maxCpa,
      );
      if (result.isViolation) {
        violations.push(result);
      }
    }
  }
}
```

## Step 4: Add a Unit Test in `ts/googleads/src/tests/rules_test.ts`

We write a test to verify the logic.

```typescript
// In ts/googleads/src/tests/rules_test.ts

it('should flag an audience with a high CPA', () => {
  const audiencePerf = {
    campaignName: 'Test Campaign',
    audienceName: 'Cart Abandoners',
    cost: 500,
    conversions: 10, // CPA = $50
  };

  const result = checkAudienceCpa(audiencePerf, 'Test Campaign', 'Cart Abandoners', 40);
  expect(result.isViolation).toBeTruthy();
});

it('should not flag an audience in a different campaign', () => {
  const audiencePerf = {
    campaignName: 'Another Campaign',
    audienceName: 'Cart Abandoners',
    cost: 500,
    conversions: 10, // CPA = $50
  };

  const result = checkAudienceCpa(audiencePerf, 'Test Campaign', 'Cart Abandoners', 40);
  expect(result.isViolation).toBeFalsy();
});
```
