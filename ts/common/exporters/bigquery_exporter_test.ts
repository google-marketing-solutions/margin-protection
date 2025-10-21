/**
 * @fileoverview Unit tests for the BigQueryStrategyExporter class.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BigQueryStrategyExporter } from './bigquery_exporter';
import { mockAppsScript } from '../test_helpers/mock_apps_script';

describe('BigQueryStrategyExporter', () => {
  let exporter: BigQueryStrategyExporter;

  beforeEach(() => {
    // Use the helper to create fresh mocks for all Apps Script services.
    mockAppsScript();

    exporter = new BigQueryStrategyExporter(
      'test_project',
      'test_dataset',
      // The mockAppsScript helper makes these available globally.
      BigQuery,
      ScriptApp,
    );
  });

  describe('export', () => {
    it('should call the BigQuery API when data is provided', () => {
      const tableName = 'test_table';
      const data = [{ id: 1, name: 'test' }];
      
      // Spy on the insertAll method and provide a mock return value
      const insertAllSpy = vi.spyOn(BigQuery.Tabledata, 'insertAll').mockReturnValue({
        insertErrors: [],
      });

      exporter.export(data, { destination: 'bigquery', tableName });

      expect(insertAllSpy).toHaveBeenCalledOnce();
    });

    it('should throw an error if table name is not provided', () => {
      const data = [{ id: 1, name: 'test' }];
      expect(() => exporter.export(data, { destination: 'bigquery' })).toThrowError(
        'Table name is required for BigQuery export.',
      );
    });

    it('should not call the BigQuery API when data is empty', () => {
      const tableName = 'test_table';
      const data: Record<string, unknown>[] = [];
      const insertAllSpy = vi.spyOn(BigQuery.Tabledata, 'insertAll');

      exporter.export(data, {
        destination: 'bigquery',
        tableName,
      });

      expect(insertAllSpy).not.toHaveBeenCalled();
    });



    it('should handle insertion failure gracefully', () => {
      const tableName = 'test_table';
      const data = [{ id: 1, name: 'test' }];
      
      // Simulate an error during the API call
      const insertAllSpy = vi.spyOn(BigQuery.Tabledata, 'insertAll').mockImplementation(() => {
        throw new Error('BigQuery API error');
      });

      // We expect the method to catch the error and not throw.
      expect(() =>
        exporter.export(data, { destination: 'bigquery', tableName }),
      ).not.toThrow();

      // Verify that the insertAll method was still called.
      expect(insertAllSpy).toHaveBeenCalledOnce();
    });
  });
});
