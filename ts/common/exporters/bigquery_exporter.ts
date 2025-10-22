/**
 * @fileoverview Implements the BigQueryStrategyExporter class for exporting data to BigQuery.
 */

import { Exporter, ExportOptions } from '../exporter.js';

/**
 * A class for exporting data to BigQuery.
 */
export class BigQueryStrategyExporter implements Exporter {
  private projectId: string;
  private datasetId: string;
  private bigQueryService: GoogleAppsScript.BigQuery;
  private scriptAppService: GoogleAppsScript.Script.ScriptApp;

  constructor(
    projectId: string = 'your_project_id',
    datasetId: string = 'your_dataset_id',
    bigQueryService: GoogleAppsScript.BigQuery = BigQuery, // Default to global BigQuery
    scriptAppService: GoogleAppsScript.Script.ScriptApp = ScriptApp, // Default to global ScriptApp
  ) {
    this.projectId = projectId;
    this.datasetId = datasetId;
    this.bigQueryService = bigQueryService;
    this.scriptAppService = scriptAppService;
  }

  export<T extends Record<string, unknown>>(
    data: T[],
    options: ExportOptions,
  ): boolean {
    if (!options.tableName) {
      throw new Error('Table name is required for BigQuery export.');
    }
    return this.insertData(options.tableName, data);
  }

  private insertData<T extends Record<string, unknown>>(
    tableName: string,
    data: T[],
  ): boolean {
    // Applied lint fixes
    if (!data || data.length === 0) {
      console.warn('No data to insert.');
      return true; // Consider this a success if no data to insert
    }

    try {
      const tableReference = this.bigQueryService.newTableReference();
      tableReference.projectId = this.projectId;
      tableReference.datasetId = this.datasetId;
      tableReference.tableId = tableName;

      const rows = data.map((row) => {
        const newRow = this.bigQueryService.newTableDataInsertAllRequestRows();
        newRow.json = row;
        return newRow;
      });

      const request = this.bigQueryService.newTableDataInsertAllRequest();
      request.rows = rows;

      const response = this.bigQueryService.Tabledata.insertAll(
        request,
        tableReference.projectId,
        tableReference.datasetId,
        tableReference.tableId,
      );

      if (response.insertErrors && response.insertErrors.length > 0) {
        console.error(
          'BigQuery insertion errors:',
          JSON.stringify(response.insertErrors, null, 2),
        );
        return false;
      }

      console.log(
        `Successful insertion into ${tableName} with ${data.length} rows.`,
      );
      console.log(
        'Type of BigQuery.newTableReference:',
        typeof this.bigQueryService.newTableReference,
      );
      return true;
    } catch (error) {
      console.error(
        `BigQuery data insertion failed for table ${tableName}:`,
        error,
      );
      return false;
    }
  }
}
