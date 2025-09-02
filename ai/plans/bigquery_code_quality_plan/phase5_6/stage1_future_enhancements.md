# Phase 5 & 6: Future Enhancements - Deeper Decoupling and AI-Assisted Rule Creation

This document outlines two future phases: Phase 5, focusing on further decoupling the codebase to enhance modularity and facilitate migration to Cloud Run, and Phase 6, introducing AI-assisted rule creation to empower users in defining and integrating new business logic.

---

## Phase 5: Deeper Decoupling for Cloud Run Readiness

**Goal:** Further enhance modularity and portability to facilitate future migration to Cloud Run.

### 1. Define `IRulesEngine` interface.

- **Step:** Create `ts/common/interfaces/rules_engine.ts` with the `IRulesEngine ` interface. \* **Tool Call:**
  ```python
  print(default_api.write_file(file_path = "/usr/local/google/home/seancjones/margin-protection/ts/common/interfaces/rules_engine.ts", content = '''
  /\*\*
  ```
- @fileoverview Defines the interface for a rules engine.
  \*/
  // ts/common/interfaces/rules_engine.ts
  /\*\*
- Defines the interface for a rules engine that applies business logic to data.
  _/
  export interface IRulesEngine {
  /\*\*
  _ Applies a set of predefined rules to the input data.
  _ @param data The input data to which the rules will be applied.
  _ @returns The processed data after applying the rules.
  \_/
  applyRules<T>(data: T[]): T[];
  }
  '''))
  ```
  _ **Expected Output:**
  `json
        {"write_file_response": {"output ": "Successfully created and wrote to new file: /usr/local/google/home/seancjones/margin-protection/ts/common/interfaces/rules_engine.ts"}}
        `
  _ **Git Commit:** `feat: Define IRulesEngine interface`
  _ **Tool Call :**
  `python
            print(default_api.run_shell_command(command = "git add ts/common/interfaces/rules_engine.ts && git commit -m \"feat: Define IRulesEngine interface\"", description = "Commit IRulesEngine interface definition"))
            ` \* **Expected Output:**
  `bash
            [main <commit-hash>] feat: Define IRulesEngine interface
             1 file changed, XX insertions(+)
             create mode 100644 ts/common/interfaces/rules_engine.ts
            `
  ```

### 2. Refactor existing rules into `IRulesEngine` implementations.

- **Step:** Create `ts/dv360/src/dv360_rules_engine.ts` implementing `IRulesEngine` and move relevant logic from `ts/dv360/src/rules.ts`. (This is a conceptual step; actual refactoring would be more involved). \* **Tool Call (Conceptual - showing the file creation):**
  ```python
  print(default_api.write_file(file_path = "/usr/local/google/home/seancjones/margin-protection/ts/ dv360/src/dv360_rules_engine.ts", content = '''
  /\*\*
  ```
- @fileoverview Concrete implementation of a rules engine for DV360.
  \*/
  // ts/dv360/src/dv360_rules_engine.ts
  import { IRulesEngine } from '../../common/interfaces/rules_engine';
  // import { applyDv3 60Rules } from './rules'; // Assuming rules.ts contains the logic

/\*\*

- Concrete implementation of IRulesEngine for DV360-specific rules.
  \_/
  export class Dv360RulesEngine implements IRulesEngine {
  applyRules<T>(data: T[]): T[] {
  console.log('Applying DV360-specific rules...');
  // Placeholder: In a real scenario, this would call the actual rule application logic
  // return applyDv360Rules(data);
  return data.map(item => ({ ...item, processedByDv360: true })); // Example transformation
  }
  }
  '''))
  ````
  _ **Expected Output:**
  `json
        {"write_file_response": {"output": "Successfully created and wrote to new file: /usr/local/google/home/seancjones/margin-protection/ ts/dv360/src/dv360_rules_engine.ts"}}
        `
  _ **Test Modification:** Create `ts/dv360/src/tests/dv360_rules_engine_test.ts` to test the new implementation.
  _ **Tool Call:**
  ```python
  print(default_api.write_file(file_path = "/usr/local/google/home/seancjones/margin-protection/ts/dv360/src/tests/dv360_rules_engine_test.ts", content = '''
  /\*\*
  ````
- @fileoverview Tests for the DV360 rules engine.
  \*/
  // ts/dv360/src/tests/dv360_rules_engine_test.ts
  import { expect } from 'chai';
  import { Dv360RulesEngine } from '../dv360_rules_engine';

describe('Dv360 RulesEngine', () => {
let rulesEngine: Dv360RulesEngine;

    beforeEach(() => {
        rulesEngine = new Dv360RulesEngine();
    });

    it('should apply DV360-specific rules to data', () => {
        const inputData  = [{ id: 1, value: 10 }, { id: 2, value: 20 }];
        const processedData = rulesEngine.applyRules(inputData);

        expect(processedData).to.have.lengthOf(2);
        expect(processedData[0]).to .have.property('processedByDv360', true);
        expect(processedData[1]).to.have.property('processedByDv360', true);
    });

    it('should return an empty array if input data is empty', () => {
        const inputData: any [] = [];
        const processedData = rulesEngine.applyRules(inputData);
        expect(processedData).to.be.empty;
    });

});
'''))
`         *   **Expected Output:**
            `json
{"write_file_response": {"output": "Successfully created and wrote to new file: /usr/local/google/home/seancjones/margin-protection/ts/dv360/src/tests/dv360_rules_engine_test.ts"}}
`         *   **Run Tests:**
            `python
print(default \_api.run_shell_command(command = "yarn test ts/dv360/src/tests/dv360_rules_engine_test.ts", description = "Run DV360 Rules Engine unit tests"))
`         *   **Expected Output (example):**
             `bash
yarn run v1.22.19
$ mocha ts/dv360/src/tests/dv360_rules_engine_test.ts

              Dv360RulesEngine
                ✔ should apply DV360-specific rules to data
                ✔  should return an empty array if input data is empty


              2 passing (XXms)
            ```
    *   **Git Commit:** `refactor: Implement Dv360RulesEngine and add tests`
        *   **Tool Call:**
            ```python
            print(default_api.run_ shell_command(command = "git add ts/dv360/src/dv360_rules_engine.ts ts/dv360/src/tests/dv360_rules_engine_test.ts && git commit -m \"refactor: Implement Dv360Rules Engine and add tests\"", description = "Commit Dv360RulesEngine and its tests"))
            ```
        *   **Expected Output:**
            ```bash
            [main <commit-hash>] refactor: Implement Dv360RulesEngine and add tests
             2 files changed, XX insertions(+)
             create  mode 100644 ts/dv360/src/dv360_rules_engine.ts
             create mode 100644 ts/dv360/src/tests/dv360_rules_engine_test.ts
            ```

### 3. Define `ILogger` interface.

- **Step:** Create `ts/common/interfaces/logger.ts` with the `ILogger` interface. \* **Tool Call:**
  ```python
  print(default_api.write_file(file_path = "/usr/local/google/home/seancjones/margin-protection/ts/common/interfaces/logger.ts", content = '''
  /\*\*
  ```
- @fileoverview Defines the interface for a logging service.
  \*/
  // ts/common/interfaces/logger.ts
  /\*\*
- Defines the interface for a logging service.
  _/
  export interface ILogger {
  /\*\*
  _ Logs an informational message.
  _ @param message The message to log.
  _ @param optionalParams Optional additional parameters to log.
  \*/
  log(message: string, ...optionalParams: any[]): void;

      /**
       * Logs a warning message.
       * @param  message The message to log.
       * @param optionalParams Optional additional parameters to log.
       */
      warn(message: string, ...optionalParams: any[]): void;

      /**
       * Logs an error message.
       * @param message The message to log.
       * @param  optionalParams Optional additional parameters to log.
       */
      error(message: string, ...optionalParams: any[]): void;

  }
  '''))
  `     *   **Expected Output:**
    `json
  {"write_file_response": {"output": "Successfully created and wrote to new file: /usr/local/google/home/seancjones/margin-protection/ts/common/interfaces/logger.ts"}}
  ``     *   **Git Commit:** `feat: Define ILogger interface`
    *   **Tool Call:**
        ``python
  print(default \_api.run_shell_command(command = "git add ts/common/interfaces/logger.ts && git commit -m \"feat: Define ILogger interface\"", description = "Commit ILogger interface definition"))
  `         *   **Expected Output:**
        `bash
  [main <commit -hash>] feat: Define ILogger interface
  1 file changed, XX insertions(+)
  create mode 100644 ts/common/interfaces/logger.ts

  ```

  ```

### 4. Implement `AppsScriptLogger`.

- **Step:** Create `ts/common/apps_ script_logger.ts` implementing `ILogger`. \* **Tool Call:**
  ```python
  print(default_api.write_file(file_path = "/usr/local/google/home/seancjones/margin-protection/ts/common/apps_script_logger .ts", content = '''
  /\*\*
  ```
- @fileoverview A logger implementation that uses the Apps Script console.
  \*/
  // ts/common/apps_script_logger.ts
  import { ILogger } from './interfaces/logger';

/\*\*

- Concrete implementation of ILogger for Apps Script's built-in console.
  \*/
  export class AppsScriptLogger implements ILogger {
  log( message: string, ...optionalParams: any[]): void {
  console.log(message, ...optionalParams);
  }

      warn(message: string, ...optionalParams: any[]): void {
          console.warn(message, ...optionalParams);
      }

      error(message:  string, ...optionalParams: any[]): void {
          console.error(message, ...optionalParams);
      }

  }
  '''))
  `     *   **Expected Output:**
    `json
  {"write_file_response": {"output": "Successfully created and wrote to new file : /usr/local/google/home/seancjones/margin-protection/ts/common/apps_script_logger.ts"}}
  ``     *   **Test Modification:** Create `ts/common/tests/apps_script_logger_test.ts` to test the new implementation.
     *   **Tool Call:**
        ``python
  print(default_api.write_file(file_path = "/usr/local/google/home/seancjones/margin-protection/ts/common/tests/apps_script_logger_test.ts", content = '''
  /\*\*

- @fileoverview Tests for the AppsScriptLogger.
  _/
  // ts /common/tests/apps_script_logger_test.ts
  import { expect } from 'chai';
  import _ as sinon from 'sinon';
  import { AppsScriptLogger } from '../apps_script_logger';

describe('AppsScriptLogger', () => {
let logger: AppsScriptLogger ;
let consoleLogStub: sinon.SinonStub;
let consoleWarnStub: sinon.SinonStub;
let consoleErrorStub: sinon.SinonStub;

    beforeEach(() => {
        logger = new AppsScriptLogger();
        consoleLogStub = sinon.stub( console, 'log');
        consoleWarnStub = sinon.stub(console, 'warn');
        consoleErrorStub = sinon.stub(console, 'error');
    });

    afterEach(() => {
        consoleLogStub.restore();
        consoleWarnStub.restore();
        consoleErrorStub .restore();
    });

    it('should log messages using console.log', () => {
        logger.log('Test log message', { key: 'value' });
        expect(consoleLogStub.calledOnceWith('Test log message', { key: 'value' })).to.be. true;
    });

    it('should log warning messages using console.warn', () => {
        logger.warn('Test warn message');
        expect(consoleWarnStub.calledOnceWith('Test warn message')).to.be.true;
    });

    it('should log error messages using console .error', () => {
        const error = new Error('Something went wrong');
        logger.error('Test error message', error);
        expect(consoleErrorStub.calledOnceWith('Test error message', error)).to.be.true;
    });

});
'''))
`          *   **Expected Output:**
            `json
{"write_file_response": {"output": "Successfully created and wrote to new file: /usr/local/google/home/seancjones/margin-protection/ts/common/tests/apps_script_logger_test.ts"}}
`         *   **Run Tests:**
            `python
print(default_api.run_shell_command(command = "yarn test ts/common/tests/apps_script_logger_test.ts", description = "Run AppsScriptLogger unit tests"))
`         *    **Expected Output (example):**
            `bash
yarn run v1.22.19
$ mocha ts/common/tests/apps_script_logger_test.ts

              AppsScriptLogger
                ✔ should log messages using console.log
                ✔ should log warning messages using console .warn
                ✔ should log error messages using console.error


              3 passing (XXms)
            ```
    *   **Git Commit:** `feat: Implement AppsScriptLogger and add tests`
        *   **Tool Call:**
            ```python
            print(default_api.run_shell _command(command = "git add ts/common/apps_script_logger.ts ts/common/tests/apps_script_logger_test.ts && git commit -m \"feat: Implement AppsScriptLogger and add tests\"", description = "Commit AppsScriptLogger and its tests"))
            ```
         *   **Expected Output:**
            ```bash
            [main <commit-hash>] feat: Implement AppsScriptLogger and add tests
             2 files changed, XX insertions(+)
             create mode 100644 ts/common/apps_script_logger.ts
             create mode 10 0644 ts/common/tests/apps_script_logger_test.ts
            ```

### 5. Integrate `ILogger` throughout the codebase.

- **Step:** Modify `BigQueryExporter` to use `ILogger` instead of direct `console.log`/`error `. (This is a conceptual step; actual integration would be more widespread).
  _ **Pre-computation:** Read `ts/common/bigquery_exporter.ts`.
  _ **Tool Call:**
  `python
        print(default_api.read_file(absolute_path = "/ usr/local/google/home/seancjones/margin-protection/ts/common/bigquery_exporter.ts"))
        `
  _ **Diagnostic:** Identify `console.log` and `console.error` calls.
  _ **Tool Call:**
  ```python
  print (default_api.replace(file_path = "/usr/local/google/home/seancjones/margin-protection/ts/common/bigquery_exporter.ts",
  old_string = '''// ts/common/bigquery_exporter.ts
  declare var BigQuery: GoogleAppsScript.BigQuery.BigQueryService; // Declare global Apps Script service
  declare var ScriptApp: GoogleAppsScript.Script.ScriptApp; // Declare global Apps Script service
  ```

export class BigQueryExporter {
private projectId: string;
private datasetId: string;

    constructor(projectId: string = 'your_project_id', datasetId: string = 'your_dataset_id') {
        this.projectId = projectId;
        this.datasetId = datasetId;
    }

    authenticate(): boolean {
        try {
            console.log('Attempting BigQuery authentication...');
            // In a real Apps Script environment, you might call BigQuery.authenticate();
            // For this example, we'll simulate success.
            return true;
        } catch (error) {
            console.error('BigQuery authentication failed:', error);
            return false;
        }
    }

    insertData(tableName: string, data: any[]): boolean {
        if (!data || data.length === 0) {
            console.warn('No data to insert.');
            return true;
        }

        try {
            const tableReference = BigQuery.newTableReference()
                .setProjectId(this.projectId)
                .setDatasetId(this.datasetId)
                .setTableId(tableName);

            const rows = data.map(row => {
                const processedRow: { [key: string]: any } = {};
                for (const key in row) {
                    if (row.hasOwnProperty(key)) {
                        if (row[key] instanceof Date) {
                            processedRow[key] = row[key].toISOString();
                        } else {
                            processedRow[key] = row[key];
                        }
                    }
                }
                return BigQuery.newTableDataInsertAllRequestRows().json(processedRow);
            });

            const request = BigQuery.newTableDataInsertAllRequest().setRows(rows);

            // In a real Apps Script environment, BigQuery.Tabledata.insertAll would be called.
            // const response = BigQuery.Tabledata.insertAll(request, tableReference.getProjectId(), tableReference.getDatasetId(), tableReference.getTableId());
            // if (response.insertErrors && response.insertErrors.length > 0) {
            //     console.error('BigQuery insertion errors:', JSON.stringify(response.insertErrors, null, 2));
            //     return false;
            // }

            console.log(`Simulating successful insertion into ${tableName} with ${data.length} rows.`);
            return true;
        } catch (error) {
            console.error(`BigQuery data insertion failed for table ${tableName}:`, error);
            return false;
        }
    }

}''',
new_string = '''// ts/common/bigquery_exporter.ts
/\*\*

- @fileoverview A class to handle exporting data to Google BigQuery.
  \*/
  declare var BigQuery: GoogleAppsScript.BigQuery.BigQueryService; // Declare global Apps Script service
  declare var ScriptApp: GoogleAppsScript.Script.ScriptApp; // Declare global Apps Script service

import { ILogger } from './interfaces/logger';
import { AppsScriptLogger } from './apps_script_logger'; // Default logger implementation

export class BigQueryExporter {
private projectId : string;
private datasetId: string;
private logger: ILogger;

    constructor(projectId: string = 'your_project_id', datasetId: string = 'your_dataset_id', logger: ILogger = new AppsScriptLogger()) {
        this.projectId = projectId;
         this.datasetId = datasetId;
        this.logger = logger;
    }

    authenticate(): boolean {
        try {
            this.logger.log('Attempting BigQuery authentication...');
            // In a real Apps Script environment, you might call BigQuery.authenticate();
            // For this example, we'll simulate success.
            return true;
        } catch (error) {
            this.logger.error('BigQuery authentication failed:', error);
            return false;
        }
    }

    insertData(tableName: string, data: any[]): boolean {
         if (!data || data.length === 0) {
            this.logger.warn('No data to insert.');
            return true;
        }

        try {
            const tableReference = BigQuery.newTableReference()
                .setProjectId(this.projectId)
                .setDatasetId(this.datasetId)
                .setTableId(tableName);

            const rows = data.map(row => {
                const processedRow: { [key: string]: any } = {};
                for (const key in row) {
                    if (row.hasOwnProperty(key)) {
                         if (row[key] instanceof Date) {
                            processedRow[key] = row[key].toISOString();
                        } else {
                            processedRow[key] = row[key];
                        }
                    }
                }
                return BigQuery.newTableDataInsertAllRequestRows().json(processedRow);
            });

            const request = BigQuery.newTableDataInsertAllRequest().setRows(rows);

            // In a real Apps Script environment, BigQuery.Tabledata.insertAll would be called.
            // const response = BigQuery.Tabledata.insertAll(request, tableReference.getProjectId(), tableReference.getDatasetId(), tableReference.getTableId());
            // if (response.insertErrors && response.insertErrors.length > 0) {
            //     this.logger.error('BigQuery insertion errors:', JSON.stringify(response.insertErrors, null, 2));
            //     return false;
            // }

            this.logger.log(`Simulating successful insertion into ${tableName} with ${data.length} rows.`);
            return true;
        } catch (error) {
            this.logger.error(`BigQuery data insertion failed for table ${tableName}: `, error);
            return false;
        }
    }

}'''))
`     *   **Expected Output:**
        `json
{"replace_response": {"output": "Successfully replaced content in /usr/local/google/home/seancjones/margin-protection/ts/common/bigquery_exporter.ts"}}
``     *   **Git Commit:** `feat: Integrate ILogger into BigQueryExporter`
        *   **Tool Call:**
            ``python
print(default_api.run_shell_command(command = "git add ts/common/bigquery_exporter.ts && git commit -m \"feat: Integrate ILogger into BigQueryExporter\"", description = "Commit integration of ILogger into BigQueryExporter"))
`         *   **Expected Output:**
            `bash
[main <commit-hash>] feat: Integrate ILogger into BigQueryExporter
1 file changed, XX insertions(+), XX deletions(-)

```

### 6. (Conceptual) Further decoupling and preparing for Cloud Run

Phase 6: AI-Assisted Rule Creation
Goal: Empower users with AI to define and integrate new business rules.

1. Research and select an AI model and platform.
   Step: Research and select suitable AI models (e.g., GPT-3, PaLM) and platforms (e.g., Google Cloud Vertex AI, OpenAI).
   Tool Call: N/A (Research phase, no code changes.)
2. Design a user interface for rule creation.
   Step: Design an intuitive user interface (UI) for users to describe rules in natural language.
   Tool Call: N/A (Design phase, no code changes.)
3. Implement rule generation with AI.
   Step: Implement the logic to translate natural language rules into code using the selected AI model.
   Tool Call: N/A (Implementation - high-level step, no specific code changes at this stage.)
4. Integrate AI-generated rules.
   Step: Develop a mechanism to integrate the AI-generated rules into the IRulesEngine.
   Tool Call: N/A (Integration - high-level step, no specific code changes at this stage.)
   This document provides a high-level overview of the planned enhancements for Phases 5 and 6. Each step will require further detailed implementation, testing, and refinement.
```
