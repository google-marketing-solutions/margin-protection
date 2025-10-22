/**
 * @fileoverview Defines the Exporter interface and the ExportContext class for the strategy pattern.
 */

/**
 * Interface for data exporters.
 */
export interface Exporter {
  export(data: unknown[], options: ExportOptions): void;
}

/**
 * Options for exporting data.
 */
export interface ExportOptions {
  destination: 'bigquery' | 'drive';
  tableName?: string;
  fileName?: string;
}

export interface BigQueryOptions extends ExportOptions {
  destination: 'bigquery';
  tableName?: string;
}

export interface DriveExportOptions {
  destination: 'drive';
  folderId: string;
  fileName?: string;
}

/**
 * Context for the export strategy.
 */
export class ExportContext {
  private strategy: Exporter;

  constructor(strategy: Exporter) {
    this.strategy = strategy;
  }

  setStrategy(strategy: Exporter) {
    this.strategy = strategy;
  }

  export(data: unknown[], options: ExportOptions): void {
    this.strategy.export(data, options);
  }
}
