/**
 * @fileoverview Unit tests for the BigQueryStrategyExporter class.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BigQueryStrategyExporter } from '../../exporters/bigquery_exporter.js';
import { mockAppsScript } from '../../test_helpers/mock_apps_script.js';

describe('BigQueryStrategyExporter', function () {
  let exporter: BigQueryStrategyExporter;
  let mockBigQueryService: GoogleAppsScript.BigQuery;

  beforeEach(function () {
    mockAppsScript();
    mockBigQueryService = BigQuery;
    exporter = new BigQueryStrategyExporter(
      'test_project',
      'test_dataset',
      mockBigQueryService,
      ScriptApp,
    );
  });

  describe('export', function () {
    it('should return true on successful data insertion', function () {
      const tableName = 'test_table';
      const data = [{ id: 1, name: 'test' }];
      const insertAllSpy = vi
        .spyOn(mockBigQueryService.Tabledata, 'insertAll')
        .mockReturnValue({ insertErrors: [] });

      const result = exporter.export(data, {
        destination: 'bigquery',
        tableName,
      });

      expect(result).toBe(true);
      expect(insertAllSpy).toHaveBeenCalledOnce();
    });

    it('should throw an error if table name is not provided', function () {
      const data = [{ id: 1, name: 'test' }];
      expect(() =>
        exporter.export(data, { destination: 'bigquery' }),
      ).toThrowError('Table name is required for BigQuery export.');
    });

    it('should call insertAll when data is provided', function () {
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

    it('should handle insertion failure gracefully', function () {
      const tableName = 'test_table';
      const data = [{ id: 1, name: 'test' }];
      const insertAllSpy = vi
        .spyOn(mockBigQueryService.Tabledata, 'insertAll')
        .mockImplementation(() => {
          throw new Error('BigQuery API error');
        });

      const result = exporter.export(data, {
        destination: 'bigquery',
        tableName,
      });

      expect(result).toBe(false);
      expect(insertAllSpy).toHaveBeenCalledOnce();
    });
  });
});
