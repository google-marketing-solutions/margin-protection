# Final Verification

## Step-by-Step Execution Plan with Git Commits (Prescriptive with Tool Calls)

This section details the final verification steps, providing exact tool calls and expected diagnostics.

### 1. Run all unit, integration, and relevant end-to-end tests across the `ts` directory.

- **Tool Call:**
  ```python
  print(default_api.run_shell_command(command = "yarn test", description = "Run all unit and integration tests"))
  ```
- **Expected Output (example):**

  ```bash
  yarn run v1.22.19
  $ mocha ts/common/tests/bigquery_exporter_test.ts ts/common/tests/data_source_test.ts ts/common/tests/sheet_helpers_test.ts ts/common/tests/integration_test.ts ts/dv360/src/tests/

    BigQueryExporter
      authenticate
        ✔ should return true on successful authentication
        ✔ should return false on failed authentication (simulated)
      insertData
        ✔ should return true on successful data insertion
        ✔ should return true if no data is provided
        ✔ should return false on failed data insertion (simulated)
        ✔ should handle various data types including Date objects

    IDataSource Interface
      ✔ should be implementable by a concrete class

    GoogleSheetDataSource
      ✔ should retrieve data from a Google Sheet by ID
      ✔ should retrieve data from a specific range in a Google Sheet
      ✔ should throw an error if the sheet cannot be opened
      ✔ should throw an error if data retrieval fails

    sheet_helpers
      getDataFromSource
        ✔ should retrieve data using the provided IDataSource
        ✔ should retrieve data from a specific range using the provided IDataSource
        ✔ should propagate errors from the data source

    Integration Test: Google Sheet to BigQuery
      ✔ should successfully read data from Google Sheet and insert into BigQuery
      ✔ should handle errors during data retrieval from Google Sheet
      ✔ should handle errors during BigQuery insertion

    DV360 Tests (assuming they all pass after api.ts removal)
      ✔ ... (many passing tests) ...

    XX passing (YYms)
  ```

- **Diagnostic:** All tests should pass. If any fail, investigate the specific test and corresponding code.

- **Git Commit:** `test: Run all tests and confirm stability`
  - **Tool Call:**
    ```python
    print(default_api.run_shell_command(command = "git add . && git commit -m "test: Run all tests and confirm stability"", description = "Commit test results"))
    ```
  - **Expected Output:**
    ```bash
    [main <commit-hash>] test: Run all tests and confirm stability
     XX files changed, XX insertions(+), XX deletions(-)
    ```

### 2. Perform a final build of the `ts` projects to ensure no compilation errors.

- **Tool Call:**
  ```python
  print(default_api.run_shell_command(command = "yarn build", description = "Perform a full TypeScript build"))
  ```
- **Expected Output (example):**
  ```bash
  yarn run v1.22.19
  $ tsc --build tsconfig.build.json
  Done in XX.XXs.
  ```
- **Diagnostic:** The build command should complete successfully without any TypeScript compilation errors.

- **Git Commit:** `build: Verify successful project build`
  - **Tool Call:**
    ```python
    print(default_api.run_shell_command(command = "git add . && git commit -m "build: Verify successful project build"", description = "Commit build verification"))
    ```
  - **Expected Output:**
    ```bash
    [main <commit-hash>] build: Verify successful project build
     XX files changed, XX insertions(+), XX deletions(-)
    ```
