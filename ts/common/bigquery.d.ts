declare global {
  declare namespace GoogleAppsScript {
    namespace BigQuery {
      interface TableReference {
        projectId: string;
        datasetId: string;
        tableId: string;
      }

      interface TableDataInsertAllRequestRows {
        json: Record<string, unknown>;
      }

      interface TableDataInsertAllRequest {
        rows: TableDataInsertAllRequestRows[];
      }

      interface TableDataInsertAllResponse {
        insertErrors?: Array<{
          index: number;
          errors: Array<{
            reason: string;
            message: string;
          }>;
        }>;
      }

      interface Tabledata {
        insertAll(
          request: TableDataInsertAllRequest,
          projectId: string,
          datasetId: string,
          tableId: string,
        ): TableDataInsertAllResponse;
      }

      interface QueryRequest {
        query: string;
        useLegacySql: boolean;
      }

      interface QueryResponse {
        schema: {
          fields: Array<{ name: string }>;
        };
        rows: Array<{
          f: Array<{ v: string }>;
        }>;
      }

      interface Jobs {
        query(request: QueryRequest, projectId: string): QueryResponse;
      }

      export interface BigQuery {
        newTableReference(): TableReference;
        newTableDataInsertAllRequestRows(): TableDataInsertAllRequestRows;
        newTableDataInsertAllRequest(): TableDataInsertAllRequest;
        Tabledata: Tabledata;
        Jobs: Jobs;
      }
    }
  }

  declare const BigQuery: GoogleAppsScript.BigQuery.BigQuery;
}
