# Plan for Code Quality Improvement and BigQuery Integration in `ts` folder

This plan addresses the user's request to improve code quality, specifically focusing on making it easier to write code directly to BigQuery, and incorporates insights from existing TODOs within the `ts` directory. It also includes a detailed test plan and a step-by-step execution plan with interleaved test modifications and git commits.

## 1. Refactor `common/sheet_helpers.ts` for Data Export

The TODOs in `ts/common/sheet_helpers.ts` (e.g., "This code is ripe for refactoring", "include this in your comprehensive review of our grid system", "let's try to separate concerns so we have a data exporter class") directly align with the goal of facilitating BigQuery integration.

**Action:**

- Create a dedicated `BigQueryExporter` class (or similar, e.g., `BigQueryWriter`) within `ts/common/` that encapsulates the logic for writing data to BigQuery. This class should handle:
  - Authentication with BigQuery.
  - Data formatting and schema mapping for BigQuery tables.
  - Insertion of data into specified BigQuery tables.
- Refactor existing data export logic in `common/sheet_helpers.ts` (if any is identified as relevant) to utilize this new `BigQueryExporter` class.

**Benefit:**

- Centralizes BigQuery-related logic, improving modularity and maintainability.
- Promotes reusability of BigQuery export functionality across the project.
- Addresses the "separate concerns" TODO by creating a dedicated data exporter.

## 2. Investigate and Potentially Deprecate `dv360/src/api.ts`

The TODO in `ts/dv360/src/api.ts` states: `// TODO(gemini): this file is not important anymore. We can use DV360's build-in API endpoints with Apps Script.`

**Action:**

- Review the current usage of `dv360/src/api.ts` to confirm its redundancy.
- If confirmed, plan for its removal or refactoring to leverage DV360's built-in Apps Script API endpoints. This may involve updating any call sites that currently depend on this file.

**Benefit:**

- Improves overall code quality by removing outdated or unused code.
- Reduces the maintenance burden and potential for confusion.

## 3. Implement Robust Error Handling

The `TODO (Developer) - Handle exception` comments in `dv360/src/api.ts` highlight a general need for better error handling. While these specific TODOs might be addressed by deprecating the file, robust error handling is crucial for any new BigQuery integration.

**Action:**

- Ensure comprehensive error handling is implemented within the new `BigQueryExporter` class. This should include:
  - Proper try-catch blocks for BigQuery API calls.
  - Meaningful error logging to assist in debugging.
  - User-friendly error messages for failed BigQuery operations.

**Benefit:**

- Increases the reliability and stability of BigQuery data writes.
- Provides clearer feedback in case of issues, simplifying troubleshooting.

## 4. Create a Proof-of-Concept (PoC) for BigQuery Export

To demonstrate the new BigQuery integration and validate the `BigQueryExporter` class.

**Action:**

- Develop a small, isolated script (e.g., `ts/common/tests/bigquery_export_poc.ts`) that utilizes the new `BigQueryExporter` to write sample data (either hardcoded or from a simple source like a mock Google Sheet) to a BigQuery table.

**Benefit:**

- Provides a working example of BigQuery integration.
- Allows for early testing and validation of the `BigQueryExporter` class.

## 5. Documentation and Examples

Clear documentation is essential for maintaining code quality and enabling future development.

**Action:**

- Add a new section to `ts/README.md` or create a new markdown file (e.g., `ts/docs/bigquery_integration.md`) detailing how to use the `BigQueryExporter` class.
- Include clear code examples demonstrating common BigQuery write operations.

**Benefit:**

- Facilitates adoption and correct usage of the new BigQuery integration.
- Improves the overall documentation of the `ts` codebase.

## 6. Decoupling from Google Sheets

The user has also requested to investigate making the code less tightly bound to Google Sheets. This aligns with the existing TODOs in `common/sheet_helpers.ts` regarding refactoring and separating concerns, particularly the idea of a "data exporter class" which implies a generic data source.

**Action:**

- **Abstract Data Source Access:**
  - Introduce an interface or abstract class, e.g., `IDataSource`, that defines methods for reading data (e.g., `getData(sourceId: string)`).
  - Create a concrete implementation for Google Sheets, e.g., `GoogleSheetDataSource`, that implements `IDataSource` and handles the specifics of reading from Google Sheets.
- **Refactor `common/sheet_helpers.ts` to use `IDataSource`:**
  - Modify functions in `sheet_helpers.ts` that currently read data from sheets to accept an `IDataSource` instance.
- **Generic Data Processing/Transformation:**
  - Ensure that any data processing or transformation functions operate on a generic data structure (e.g., an array of objects) rather than Google Sheets-specific data structures.
- **Data Exporter Integration:**
  - Ensure the `BigQueryExporter` (or `IDataExporter`) is designed to work with the generic data structure provided by `IDataSource`.
- **Update Configuration/Entry Points:**
  - Identify and update the main entry points or configuration files where the Google Sheets dependency is currently hardcoded to use the new abstraction.

**Benefit:**

- Increases flexibility by allowing easy integration of other data sources in the future.
- Improves testability by enabling mocking of data sources.
- Enhances modularity and reduces interdependencies within the codebase.

---

## Detailed Test Plan

This test plan outlines the testing strategy for each phase of the refactoring and new feature implementation. The goal is to ensure correctness, maintainability, and robustness of the changes.

### General Testing Principles:

- **Unit Tests:** Focus on individual functions/classes in isolation, using mocks for dependencies.
- **Integration Tests:** Verify interactions between different components (e.g., `IDataSource` with `BigQueryExporter`).
- **End-to-End Tests:** (If applicable and feasible within the Apps Script environment) Verify the entire flow from data source to BigQuery.
- **Regression Testing:** Run existing test suites to ensure no existing functionality is broken.

### Test Phases:

#### Phase 1: BigQueryExporter Implementation & Unit Testing

- **Objective:** Verify the `BigQueryExporter` class correctly formats data and interacts with the BigQuery API.
- **Test Cases:**
  - **`BigQueryExporter.authenticate()`:**
    - Test successful authentication with valid credentials.
    - Test authentication failure with invalid credentials.
  - **`BigQueryExporter.insertData()`:**
    - Test successful insertion of a single row.
    - Test successful insertion of multiple rows.
    - Test insertion with various data types (strings, numbers, booleans, dates).
    - Test insertion into a non-existent table (expect appropriate error handling).
    - Test insertion with schema mismatches (expect appropriate error handling).
    - Test error handling during API calls (e.g., network issues, BigQuery service errors).
- **Tools/Frameworks:** Mocha, Chai, Sinon (for mocking BigQuery API calls).
- **Test File Location:** `ts/common/tests/bigquery_exporter_test.ts`

#### Phase 2: IDataSource & GoogleSheetDataSource Implementation & Unit Testing

- **Objective:** Verify the `IDataSource` interface and its `GoogleSheetDataSource` implementation correctly abstract data retrieval from Google Sheets.
- **Test Cases:**
  - **`GoogleSheetDataSource.getData()`:**
    - Test successful retrieval of data from a mock Google Sheet.
    - Test retrieval from an empty sheet.
    - Test retrieval from a sheet with various data types.
    - Test error handling when sheet is not found or access is denied.
  - **`IDataSource` (Interface):**
    - Ensure other mock data sources can implement the interface correctly.
- **Tools/Frameworks:** Mocha, Chai, Sinon (for mocking Apps Script `SpreadsheetApp` and `Sheet` objects).
- **Test File Location:** `ts/common/tests/data_source_test.ts`

#### Phase 3: Refactoring `sheet_helpers.ts` & Integration Testing

- **Objective:** Verify that `sheet_helpers.ts` functions correctly after being refactored to use `IDataSource`, and that the integration with `BigQueryExporter` works.
- **Test Cases:**
  - **Refactored `sheet_helpers` functions:**
    - Test existing functionalities of `sheet_helpers` (e.g., reading specific ranges, writing to sheets) using the `IDataSource` abstraction.
    - Ensure no regression in existing `sheet_helpers` tests.
  - **Integration with BigQueryExporter:**
    - Test a complete flow: `GoogleSheetDataSource` -> `sheet_helpers` (if it transforms data) -> `BigQueryExporter`.
    - Use mock BigQuery API for these integration tests.
- **Tools/Frameworks:** Mocha, Chai, Sinon.
- **Test File Location:** Update existing `ts/common/tests/sheet_helpers_test.ts` and potentially add new integration test files.

#### Phase 4: `dv360/src/api.ts` Deprecation & Regression Testing

- **Objective:** Confirm that `dv360/src/api.ts` can be safely removed or refactored without breaking existing functionality.
- **Test Cases:**
  - Run all existing DV360-related tests (`ts/dv360/src/tests/`).
  - If `dv360/src/api.ts` is removed, ensure no compilation errors or runtime issues.
  - If refactored, ensure the new implementation behaves identically to the old one.
- **Tools/Frameworks:** Mocha, existing DV360 test suite.

#### Phase 5: Proof-of-Concept (PoC) & End-to-End Verification

- **Objective:** Demonstrate the full BigQuery export functionality in a realistic scenario.
- **Test Cases:**
  - Run the PoC script.
  - Manually verify data in the target BigQuery table.
  - Test with different data volumes and complexities.
- **Tools/Frameworks:** Manual verification, potentially a simple script to query BigQuery and assert data.

---

## Step-by-Step Execution Plan with Git Commits

This section details the implementation steps, interleaved with test modifications and git commit points. Each commit should represent a logical, testable unit of work.

### Phase 1: Setup and BigQueryExporter Core

**Goal:** Establish the foundation for BigQuery integration with unit tests.

1.  **Step:** Create `ts/common/bigquery_exporter.ts` with a basic class structure and placeholder methods for authentication and data insertion.

    - **Test Modification:** Create `ts/common/tests/bigquery_exporter_test.ts` with initial unit tests for authentication and `insertData` (using mocks for BigQuery API). These tests will initially fail.
    - **Git Commit:** `feat: Add BigQueryExporter class and initial failing unit tests`

2.  **Step:** Implement `BigQueryExporter.authenticate()` using Apps Script's `BigQuery` service (or a suitable mock for local testing).

    - **Test Modification:** Update `bigquery_exporter_test.ts` to include mock BigQuery service responses for successful and failed authentication. Run tests.
    - **Git Commit:** `feat: Implement BigQueryExporter authentication and pass unit tests`

3.  **Step:** Implement `BigQueryExporter.insertData()` to handle basic data insertion into a BigQuery table. Focus on a simple schema first.

    - **Test Modification:** Add more unit tests to `bigquery_exporter_test.ts` for `insertData`, covering successful insertion of single/multiple rows and basic error cases. Run tests.
    - **Git Commit:** `feat: Implement BigQueryExporter data insertion and pass unit tests`

4.  **Step:** Enhance `BigQueryExporter.insertData()` to handle various data types and more robust error handling (as per Plan Section 3).
    - **Test Modification:** Add comprehensive unit tests for data type handling and error scenarios (e.g., network errors, schema mismatches). Run tests.
    - **Git Commit:** `feat: Enhance BigQueryExporter with robust error handling and data type support`

### Phase 2: Decoupling Data Sources

**Goal:** Introduce data source abstraction and refactor `sheet_helpers.ts`.

1.  **Step:** Define `IDataSource` interface in `ts/common/types.ts` (or a new `ts/common/interfaces.ts`).

    - **Test Modification:** Create `ts/common/tests/data_source_test.ts` with initial tests for `IDataSource` (e.g., ensuring mock implementations adhere to the interface).
    - **Git Commit:** `feat: Define IDataSource interface`

2.  **Step:** Create `ts/common/google_sheet_data_source.ts` implementing `IDataSource` and containing the logic to read data from Google Sheets.

    - **Test Modification:** Add unit tests to `data_source_test.ts` for `GoogleSheetDataSource`, mocking Apps Script `SpreadsheetApp` and `Sheet` objects. Run tests.
    - **Git Commit:** `feat: Implement GoogleSheetDataSource and pass unit tests`

3.  **Step:** Refactor `common/sheet_helpers.ts` functions that read data to accept and use an `IDataSource` instance instead of direct Google Sheets API calls.

    - **Test Modification:** Update existing `ts/common/tests/sheet_helpers_test.ts` to use mock `IDataSource` implementations. Ensure all existing tests still pass. Add new tests if necessary to cover the `IDataSource` integration.
    - **Git Commit:** `refactor: Decouple sheet_helpers from direct Google Sheets API using IDataSource`

4.  **Step:** Ensure generic data processing/transformation in `sheet_helpers.ts` operates on the generic data structure provided by `IDataSource`.
    - **Test Modification:** Review and adjust `sheet_helpers_test.ts` to confirm that data processing logic is independent of the source.
    - **Git Commit:** `refactor: Ensure generic data processing in sheet_helpers`

### Phase 3: Integration and Deprecation

**Goal:** Integrate the new components and handle `dv360/src/api.ts` deprecation.

1.  **Step:** Integrate `BigQueryExporter` with the `IDataSource` abstraction. This might involve modifying the `BigQueryExporter` to accept an `IDataSource` or a generic data array.

    - **Test Modification:** Add integration tests to `ts/common/tests/integration_test.ts` (new file) that simulate a flow from `GoogleSheetDataSource` through `sheet_helpers` (if applicable) to `BigQueryExporter`. Use mocks for external APIs.
    - **Git Commit:** `feat: Integrate BigQueryExporter with IDataSource abstraction`

2.  **Step:** Investigate `dv360/src/api.ts` usage. If confirmed redundant, remove the file and update any imports. If still used, refactor it to use built-in Apps Script APIs.

    - **Test Modification:** Run all `ts/dv360/src/tests/` to ensure no regressions. If removed, ensure no compilation errors.
    - **Git Commit:** `refactor: Deprecate/Remove dv360/src/api.ts and verify no regressions`

3.  **Step:** Update application entry points and configuration to use the new `IDataSource` and `BigQueryExporter` where appropriate. This might involve changes in `main.ts` files or `client.ts`.
    - **Test Modification:** Run relevant end-to-end tests (if any exist or can be easily created) to verify the updated flow.
    - **Git Commit:** `chore: Update application entry points to use new data source and exporter`

### Phase 4: Proof-of-Concept and Documentation

**Goal:** Demonstrate the new functionality and provide clear documentation.

1.  **Step:** Develop the Proof-of-Concept (PoC) script (`ts/common/tests/bigquery_export_poc.ts`) that uses the new `BigQueryExporter` and `GoogleSheetDataSource` to write sample data to BigQuery.

    - **Test Modification:** This is the PoC itself, so its execution is the test.
    - **Git Commit:** `feat: Add BigQuery export Proof-of-Concept script`

2.  **Step:** Add comprehensive documentation for the `BigQueryExporter` and `IDataSource` usage. This could be a new markdown file `ts/docs/bigquery_integration.md` or an update to `ts/README.md`.
    - **Test Modification:** N/A (documentation review).
    - **Git Commit:** `docs: Add documentation for BigQuery integration and data source abstraction`

### Final Verification

1.  **Step:** Run all unit, integration, and relevant end-to-end tests across the `ts` directory.

    - **Command:** `yarn test` (assuming `yarn test` runs all tests based on `package.json` and `mocharc.json`).
    - **Git Commit:** `test: Run all tests and confirm stability`

2.  **Step:** Perform a final build of the `ts` projects to ensure no compilation errors.
    - **Command:** `yarn build` (assuming `yarn build` is the standard build command).
    - **Git Commit:** `build: Verify successful project build`
