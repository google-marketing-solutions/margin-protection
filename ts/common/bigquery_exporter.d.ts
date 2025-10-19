/**
 * @fileoverview Type definition for BigQueryExporter class.
 */

export declare class BigQueryStrategyExporter {
  private projectId;
  private datasetId;
  private bigQueryService;
  private scriptAppService;
  constructor(
    projectId?: string,
    datasetId?: string,
    bigQueryService?: GoogleAppsScript.BigQuery,
    scriptAppService?: GoogleAppsScript.Script.ScriptApp,
  );
  authenticate(): boolean;
  insertData(tableName: string, data: unknown[]): boolean;
}
