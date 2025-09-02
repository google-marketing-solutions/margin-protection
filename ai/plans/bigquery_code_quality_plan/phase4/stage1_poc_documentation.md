# Phase 4: Proof-of-Concept and Documentation

**Goal:** Demonstrate the new functionality and provide clear documentation.

## Step-by-Step Execution Plan with Git Commits (Prescriptive with Tool Calls)

This section details the implementation steps, interleaved with test modifications and git commit points, providing exact tool calls and expected diagnostics.

### 1. Develop the Proof-of-Concept (PoC) script (`ts/common/tests/bigquery_export_poc.ts`) that uses the new `BigQueryExporter` and `GoogleSheetDataSource` to write sample data to BigQuery.

- **Tool Call:**
  ```python
  print(default_api.write_file(file_path = "/usr/local/google/home/seancjones/margin-protection/ts/common/tests/bigquery_export_poc.ts", content = '''
  // ts/common/tests/bigquery_export_poc.ts
  import { GoogleSheetDataSource } from '../google_sheet_data_source';
  import { BigQueryExporter } from '../bigquery_exporter';
  import { map2DArrayToObjects } from '../data_mapper';
  ```

// This is a simplified PoC for demonstration.
// In a real Apps Script environment, this would be triggered by a menu item or time-driven trigger.

function runBigQueryExportPoC() {
console.log('Starting BigQuery Export PoC...');

    // Replace with your actual Google Sheet ID, BigQuery Project ID, Dataset ID, and Table Name
    const sheetId = 'YOUR_GOOGLE_SHEET_ID';
    const bigQueryProjectId = 'YOUR_BIGQUERY_PROJECT_ID';
    const bigQueryDatasetId = 'YOUR_BIGQUERY_DATASET_ID';
    const bigQueryTableName = 'your_poc_table';

    const sheetDataSource = new GoogleSheetDataSource();
    const bigQueryExporter = new BigQueryExporter(bigQueryProjectId, bigQueryDatasetId);

    try {
        // 1. Get data from Google Sheet
        console.log(`Reading data from Google Sheet: ${sheetId}`);
        const rawData = sheetDataSource.getData(sheetId);
        if (rawData.length === 0) {
            console.warn('No data found in the specified Google Sheet.');
            return;
        }
        console.log(`Read ${rawData.length} rows from Google Sheet.`);

        // 2. Map 2D array to objects for BigQuery
        const dataToExport = map2DArrayToObjects(rawData);
        console.log(`Mapped ${dataToExport.length} rows for BigQuery export.`);

        // 3. Authenticate and insert into BigQuery
        if (bigQueryExporter.authenticate()) {
            console.log('BigQuery authentication successful.');
            const success = bigQueryExporter.insertData(bigQueryTableName, dataToExport);
            if (success) {
                console.log('Data successfully exported to BigQuery!');
            } else {
                console.error('Failed to export data to BigQuery. Check logs for details.');
            }
        } else {
            console.error('BigQuery authentication failed.');
        }
    } catch (error) {
        console.error('An error occurred during PoC execution:', error);
    }

}

// To run this PoC in Apps Script, you would typically:
// 1. Copy the compiled JavaScript into an Apps Script project.
// 2. Replace placeholders (YOUR_GOOGLE_SHEET_ID, etc.).
// 3. Run `runBigQueryExportPoC()` from the Apps Script editor.
// @ts-ignore
global.runBigQueryExportPoC = runBigQueryExportPoC;
'''))

````

- **Expected Output:**

  ```json
  {"write_file_response": {"output": "Successfully created and wrote to new file: /usr/local/google/home/seancjones/margin-protection/ts/common/tests/bigquery_export_poc.ts"}}
````

- **Test Modification:** This is the PoC itself, so its execution is the test.

  - **Tool Call (Conceptual execution, not a direct `yarn test`):**
    - **Explanation:** To "run" this PoC, a user would typically compile the TypeScript to JavaScript, copy it into an Apps Script project, and then execute it within the Apps Script environment. This cannot be directly simulated with `yarn test`. The diagnostic step below outlines how a user would verify it.
  - **Diagnostic:**
    1.  Compile the `ts` project: `yarn build` (or `tsc`).
    2.  Copy the compiled JavaScript from `ts/dist/common/tests/bigquery_export_poc.js` (or similar path) into an Apps Script project.
    3.  Replace the placeholder IDs (`YOUR_GOOGLE_SHEET_ID`, `YOUR_BIGQUERY_PROJECT_ID`, etc.) with actual values.
    4.  Run the `runBigQueryExportPoC()` function from the Apps Script editor.
    5.  Check the Apps Script execution logs for success messages or errors.
    6.  Verify the data has been inserted into the specified BigQuery table using the BigQuery UI or `bq query` command.

- **Git Commit:** `feat: Add BigQuery export Proof-of-Concept script`
  - **Tool Call:**
    ```python
    print(default_api.run_shell_command(command = "git add ts/common/tests/bigquery_export_poc.ts && git commit -m "feat: Add BigQuery export Proof-of-Concept script"", description = "Commit BigQuery PoC script"))
    ```
  - **Expected Output:**
    ```bash
    [main <commit-hash>] feat: Add BigQuery export Proof-of-Concept script
     1 file changed, XX insertions(+)
     create mode 100644 ts/common/tests/bigquery_export_poc.ts
    ```

### 2. Add comprehensive documentation for the `BigQueryExporter` and `IDataSource` usage. This could be a new markdown file `ts/docs/bigquery_integration.md` or an update to `ts/README.md`.

- **Tool Call (Create `ts/docs/bigquery_integration.md`):**
  ```python
  print(default_api.write_file(file_path = "/usr/local/google/home/seancjones/margin-protection/ts/docs/bigquery_integration.md", content = '''
  ```

# BigQuery Integration and Data Source Abstraction

This document provides guidance on using the new BigQuery integration and the abstracted data source mechanisms within the `ts` project.

## BigQueryExporter

The `BigQueryExporter` class (`ts/common/bigquery_exporter.ts`) provides a standardized way to export data to Google BigQuery from Apps Script.

### Usage

1.  **Initialization:**

    ```typescript
    import { BigQueryExporter } from '../common/bigquery_exporter';

    const bigQueryExporter = new BigQueryExporter('YOUR_BIGQUERY_PROJECT_ID', 'YOUR_BIGQUERY_DATASET_ID');
    ```

    - Replace `YOUR_BIGQUERY_PROJECT_ID` and `YOUR_BIGQUERY_DATASET_ID` with your actual Google Cloud Project ID and BigQuery Dataset ID.

2.  **Authentication:**
    The `authenticate()` method attempts to ensure the BigQuery service is accessible. In Apps Script, this often relies on project permissions.

    ```typescript
    if (bigQueryExporter.authenticate()) {
        console.log('BigQuery authentication successful.');
    } else {
        console.error('BigQuery authentication failed. Check Apps Script project permissions.');
    }
    ```

3.  **Inserting Data:**
    The `insertData()` method takes a table name and an array of objects (JSON rows) to insert into BigQuery.

    ```typescript
    const tableName = 'your_target_table_name';
    const dataToInsert = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 24 },
    ];

    const success = bigQueryExporter.insertData(tableName, dataToInsert);
    if (success) {
        console.log(`Successfully inserted ${dataToInsert.length} rows into ${tableName}.`);
    } else {
        console.error(`Failed to insert data into ${tableName}.`);
    }
    ```

    - Ensure the keys in your data objects match the column names in your BigQuery table.
    - Date objects will be automatically converted to ISO 8601 strings.

## IDataSource and GoogleSheetDataSource

The `IDataSource` interface (`ts/common/types.ts`) provides an abstraction for retrieving data, decoupling data consumers from the specific source implementation. `GoogleSheetDataSource` (`ts/common/google_sheet_data_source.ts`) is a concrete implementation for Google Sheets.

### Usage

1.  **IDataSource Interface:**

    ```typescript
    // ts/common/types.ts
    export interface IDataSource {
        getData(sourceId: string, range?: string): any[][];
    }
    ```

    - `sourceId`: A unique identifier for the data source (e.g., Google Sheet ID).
    - `range` (optional): A specific range within the source (e.g., "Sheet1!A1:B10" for Google Sheets).
    - Returns data as a 2D array (rows and columns).

2.  **GoogleSheetDataSource:**

    ```typescript
    import { GoogleSheetDataSource } from '../common/google_sheet_data_source';

    const sheetDataSource = new GoogleSheetDataSource();
    const sheetId = 'YOUR_GOOGLE_SHEET_ID';
    const data = sheetDataSource.getData(sheetId, 'Sheet1!A:C');
    console.log('Data from sheet:', data);
    ```

## Data Mapping

The `map2DArrayToObjects` function (`ts/common/data_mapper.ts`) helps convert the 2D array format returned by `IDataSource` implementations into an array of objects, which is a more convenient format for BigQuery insertion.

### Usage

```typescript
import { map2DArrayToObjects } from '../common/data_mapper';

const twoDArrayData = [
    ['Header1', 'Header2'],
    ['ValueA1', 'ValueA2'],
    ['ValueB1', 'ValueB2'],
];

const arrayOfObjects = map2DArrayToObjects(twoDArrayData);
// arrayOfObjects will be:
// [
//   { Header1: 'ValueA1', Header2: 'ValueA2' },
//   { Header1: 'ValueB1', Header2: 'ValueB2' },
// ]
console.log('Mapped data:', arrayOfObjects);
```

## End-to-End Example (from `ts/client/client.ts`)

```typescript
// Simplified example from client.ts
import { GoogleSheetDataSource } from '../common/google_sheet_data_source';
import { BigQueryExporter } from '../common/bigquery_exporter';
import { getDataFromSource } from '../common/sheet_helpers'; // Uses IDataSource
import { map2DArrayToObjects } from '../common/data_mapper';

function exportDataToBigQueryExample() {
    const sheetId = 'YOUR_ACTIVE_SPREADSHEET_ID'; // e.g., SpreadsheetApp.getActiveSpreadsheet().getId();
    const bigQueryProjectId = 'YOUR_BIGQUERY_PROJECT_ID';
    const bigQueryDatasetId = 'YOUR_BIGQUERY_DATASET_ID';
    const bigQueryTableName = 'your_target_table_name';

    const sheetDataSource = new GoogleSheetDataSource();
    const bigQueryExporter = new BigQueryExporter(bigQueryProjectId, bigQueryDatasetId);

    try {
        const rawData = getDataFromSource(sheetDataSource, sheetId);
        const dataToExport = map2DArrayToObjects(rawData);

        if (bigQueryExporter.authenticate()) {
            const success = bigQueryExporter.insertData(bigQueryTableName, dataToExport);
            if (success) {
                console.log('Data export successful!');
            } else {
                console.error('Data export failed.');
            }
        } else {
            console.error('BigQuery authentication failed.');
        }
    } catch (error) {
        console.error('Error during export:', error);
    }
}
```

'''))

````

- **Expected Output:**

  ```json
  {"write_file_response": {"output": "Successfully created and wrote to new file: /usr/local/google/home/seancjones/margin-protection/ts/docs/bigquery_integration.md"}}
````

- **Test Modification:** N/A (documentation review).
- **Git Commit:** `docs: Add documentation for BigQuery integration and data source abstraction`
  - **Tool Call:**
    ```python
    print(default_api.run_shell_command(command = "git add ts/docs/bigquery_integration.md && git commit -m "docs: Add documentation for BigQuery integration and data source abstraction"", description = "Commit BigQuery integration documentation"))
    ```
  - **Expected Output:**
    ```bash
    [main <commit-hash>] docs: Add documentation for BigQuery integration and data source abstraction
     1 file changed, XX insertions(+)
     create mode 100644 ts/docs/bigquery_integration.md
    ```
