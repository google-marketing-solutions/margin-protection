/**
 * @fileoverview Implements the DriveExporter class for exporting data to Google Drive.
 */

import { DriveExportOptions, Exporter } from '../exporter.js';

/**
 * A class for exporting data to Google Drive.
 */
export class DriveExporter implements Exporter {
  export(data: unknown[], options: DriveExportOptions): void {
    // The data is expected to be a string[][] from getMatrixOfResults
    const csv = this.convertToCsv(data as string[][]);
    const blob = Utilities.newBlob(csv, 'text/csv', options.fileName);

    // This assumes getOrCreateFolder has been called and the folderId is available
    // The folderId should be passed in the options. For now, I'll use a placeholder.
    // In the sheet_helpers, the folderId is retrieved before calling the exporter.
    // To keep the exporter decoupled, we should expect folderId in options.

    Drive.Files.create(
      {
        parents: [options.folderId],
        name: options.fileName,
        mimeType: 'text/csv',
      },
      blob,
    );
    console.info(`Exported data to Google Drive: ${options.fileName}`);
  }

  private convertToCsv(data: string[][]): string {
    if (!data || data.length === 0) {
      return '';
    }
    return data
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
  }
}
