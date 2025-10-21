# Gemini Best Practices

This document outlines best practices for developing and testing in this project. Adherence to these principles is mandatory.

## Testing

This section outlines the best practices for writing effective, reliable, and maintainable tests.

### The Golden Rule: Test Behavior, Not Implementation

Our tests must verify the **observable outcome** of our code, not the internal steps it took to get there. A test that only checks if a function was called is brittle and useless. A test that checks if a spreadsheet cell now contains the correct value is robust and valuable.

**The Core Pattern: Arrange, Act, Assert (AAA)**

All tests should follow this structure:

1.  **Arrange:** Set up the specific state of the world needed for this test.
2.  **Act:** Execute the one function or method being tested.
3.  **Assert:** Verify that the world is in the new, expected state.

---

### 1. The `mockAppsScript` Framework is Mandatory

Any test that touches a Google Apps Script service (`SpreadsheetApp`, `PropertiesService`, `Drive`, `CacheService`, etc.) **must** use the `mockAppsScript` helper.

- **What it is:** A helper function that creates a clean, in-memory, fake version of all Apps Script services.
- **Why it's mandatory:** It ensures that every test runs in a predictable, isolated sandbox. This prevents tests from interfering with each other and eliminates flaky results.

#### How to Use It

Always call `mockAppsScript()` inside a `beforeEach` block. This guarantees a fresh mock environment for every single test case.

```typescript
import { mockAppsScript } from 'common/test_helpers/mock_apps_script';

describe('My Feature', () => {
  beforeEach(() => {
    // This is the most important line in your test file.
    mockAppsScript();
  });

  it('should do something correctly', () => {
    // ... your test logic here
  });
});
```

### 2. How to Test: Verifying the Final State

The goal is to check the result, not the process.

#### Good Example: Testing a Migration

The test for the `DriveIdToSettingsJson` migration is a perfect model for this principle.

**File:** `common/migrations/tests/20251020.0_drive_id_to_settings_json_test.ts`

**What it does right:**

1.  **Arrange:** It creates stubs for the specific ranges (`DRIVE_ID`, `SETTINGS`) that the migration will interact with.
2.  **Act:** It calls `migration.apply()`.
3.  **Assert:** It **does not** just check `setValue.calledOnce`. It inspects the **argument** that `setValue` was called with (`settingsRange.setValue.firstCall.args[0]`) and asserts that it is the correct, expected JSON payload. This is a powerful and precise assertion.

#### Bad Example (Historical Failure):

Previous, failed attempts to test the legacy migration focused on creating complex spies to see if `setValue` was called, but failed to check _what it was called with_. This led to a test that passed even when the underlying logic was broken. **Do not repeat this mistake.**

### 3. Use Test Helpers for Complex Arrangements

When a test requires a complex setup (e.g., a spreadsheet with multiple headers, categories, and values), do not build that state manually within the test case. Encapsulate the setup in a dedicated helper function.

#### Good Example: Testing Business Rules

The tests for the business logic in DV360 are excellent examples of this.

**File:** `dv360/src/tests/rules_test.ts`
**Helper File:** `dv360/src/tests/rules_test_helpers.ts`

**What it does right:**

- Functions like `generateGeoTestData` and `insertionOrderPacingRuleTestData` accept a few key parameters and return a fully realized, complex test environment.
- This keeps the actual test cases (`it(...)` blocks) short, clean, and focused on the specific assertion being made. It's immediately clear what is being tested.

### 4. Mocha-Specific Conventions

#### Use `function()` for Mocha Hooks and Tests

When writing `describe`, `it`, `beforeEach`, etc., use the `function() {}` syntax instead of arrow functions `() => {}`.

**Why:** Mocha uses the `this` context to provide useful methods like `this.timeout()`. Arrow functions do not have their own `this` context (they inherit it from the enclosing scope), so you will not be able to access these Mocha features if you use them.

**Correct:**

```typescript
describe('My Feature', function() {
  it('should do something time-intensive', function() {
    this.timeout(5000); // This only works with function()
    // ...
  });
});
```

**Incorrect:**

```typescript
describe('My Feature', () => {
  it('should do something time-intensive', () => {
    this.timeout(5000); // 'this' is undefined or the wrong context, this will fail.
    // ...
  });
});
```

### Summary of Mandates

1.  **Always** use `mockAppsScript()` in `beforeEach` for any test involving Apps Script services.
2.  **Always** test the final, observable state of the system (e.g., the value in a cell, the files in the fake Drive, the data in the cache).
3.  **Never** write a test that only checks if a function was called without also checking the arguments it was called with.
4.  **Always** encapsulate complex test setup into helper functions.
5.  **Always** use `function() {}` for Mocha's `describe`, `it`, and hook functions.

Adherence to these principles is not optional. It is the minimum standard for professional software engineering in this project.
