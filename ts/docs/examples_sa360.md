# SA360 Rule Example: Keyword Quality Score

This guide demonstrates how to create a custom rule to monitor for low Quality Score keywords in a Search Ads 360 (SA360) account.

**Goal:** Alert the user if any enabled keyword's Quality Score drops below a specified threshold, as this can negatively impact ad performance and cost.

## Step 1: Define the Rule in `ts/common/types.ts`

We define a rule that specifies a `minQualityScore`.

```typescript
// In ts/common/types.ts

export type Rule =
  // ... other rules
  | {type: 'sa360_quality_score'; minQualityScore: number};
```

## Step 2: Implement the Rule Logic in `ts/sa360/src/rules.ts`

This logic is specific to SA360, so we'll add it in the `ts/sa360/` directory. The SA360 API provides keyword data, including the Quality Score.

```typescript
// In a new file ts/sa360/src/rules.ts or an existing one

import {Keyword} from './types'; // Assuming a type definition for SA360 keywords
import {CheckResult} from '../../common/types';

/**
 * Checks if an SA360 keyword's Quality Score is below a minimum.
 * @param {Keyword} keyword The keyword to check.
 * @param {number} minQualityScore The minimum allowed Quality Score (1-10).
 * @return {CheckResult} The result of the check.
 */
export function checkKeywordQualityScore(
  keyword: Keyword,
  minQualityScore: number,
): CheckResult {
  // Don't check paused keywords or keywords with no score yet.
  if (keyword.status !== 'ENABLED' || !keyword.qualityScore) {
    return {isViolation: false};
  }

  if (keyword.qualityScore < minQualityScore) {
    return {
      isViolation: true,
      message: `Keyword "${keyword.text}" in Ad Group "${keyword.adGroupName}" has a Quality Score of ${keyword.qualityScore}, which is below the threshold of ${minQualityScore}.`,
    };
  }

  return {isViolation: false};
}
```

## Step 3: Integrate the Rule in `ts/sa360/src/main.ts`

We call our new function from the main execution loop.

```typescript
// In ts/sa360/src/main.ts

// Assuming `keywords` and `rules` are fetched
for (const rule of rules) {
  if (rule.type === 'sa360_quality_score') {
    for (const keyword of keywords) {
      const result = checkKeywordQualityScore(keyword, rule.minQualityScore);
      if (result.isViolation) {
        violations.push(result);
      }
    }
  }
}
```

## Step 4: Add a Unit Test in `ts/sa360/src/tests/rules_test.ts`

We write a test to verify the logic.

```typescript
// In ts/sa360/src/tests/rules_test.ts

it('should flag a keyword with a low quality score', () => {
  const keyword = {
    text: 'cheap widgets',
    adGroupName: 'Test Ad Group',
    status: 'ENABLED',
    qualityScore: 3,
  };

  const result = checkKeywordQualityScore(keyword, 5);
  expect(result.isViolation).toBeTruthy();
});

it('should not flag a paused keyword with a low quality score', () => {
  const keyword = {
    text: 'cheap widgets',
    adGroupName: 'Test Ad Group',
    status: 'PAUSED',
    qualityScore: 3,
  };

  const result = checkKeywordQualityScore(keyword, 5);
  expect(result.isViolation).toBeFalsy();
});
```
