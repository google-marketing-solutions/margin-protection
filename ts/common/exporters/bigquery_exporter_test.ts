/**
 * @fileoverview Unit tests for the BigQueryStrategyExporter class.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BigQueryStrategyExporter } from './bigquery_exporter.js';
import { mockAppsScript } from '../test_helpers/mock_apps_script.js';

describe('BigQueryStrategyExporter', () => {
  let exporter: BigQueryStrategyExporter;
  let mockBigQueryService: GoogleAppsScript.BigQuery;

  beforeEach(() => {
    mockAppsScript();
    mockBigQueryService = BigQuery;
    exporter = new BigQueryStrategyExporter(
      'test_project',
      'test_dataset',
      mockBigQueryService,
      ScriptApp,
    );
  });

  describe('export', () => {
    it('should return true on successful data insertion', () => {
      const tableName = 'test_table';
      const data = [{ id: 1, name: 'test' }];
      vi.spyOn(mockBigQueryService.Tabledata, 'insertAll').mockReturnValue({}); // Adjust mock return value as needed

      // Sanity check to ensure the exporter is using the mocked service.
      expect(
        (exporter as unknown as { bigQueryService: GoogleAppsScript.BigQuery })
          .bigQueryService,
      ).toBe(mockBigQueryService);

      const result = exporter.export(data, {
        destination: 'bigquery',
        tableName,
      });
      expect(result).toBe(true);
    });

    it('should call insertAll when data is provided', () => {
      const tableName = 'test_table';
      const data = [
        { a: '1', b: '2' },
        { a: '3', b: '4' },
      ];
      const insertAllSpy = vi.spyOn(mockBigQueryService.Tabledata, 'insertAll');

      exporter.export(data, {
        destination: 'bigquery',
        tableName,
      });

      expect(insertAllSpy).toHaveBeenCalledOnce();
    });

    it('should throw an error if table name is not provided', () => {
      const data = [{ id: 1, name: 'test' }];
      expect(() =>
        exporter.export(data, { destination: 'bigquery' }),
      ).toThrowError('Table name is required for BigQuery export.');
    });

    it('should handle insertion failure gracefully', () => {
      const tableName = 'test_table';
      const data = [{ id: 1, name: 'test' }];

      vi.spyOn(mockBigQueryService.Tabledata, 'insertAll').mockImplementation(
        () => {
          throw new Error('BigQuery API error');
        },
      );
      exporter.export(data, { destination: 'bigquery', tableName });
      expect(mockBigQueryService.Tabledata.insertAll).toHaveBeenCalledOnce();
    });
  });
});
