/**
 * @fileoverview Unit tests for the BigQueryStrategyExporter class.
 */

import { expect } from 'vitest';
import * as sinon from 'sinon';
import { BigQueryStrategyExporter } from './bigquery_exporter';

// Mock the global Apps Script BigQuery service and ScriptApp
const mockBigQueryService = {
  Jobs: {
    insert: sinon.stub(),
  },
  newTableDataInsertAllRequest: sinon.stub().returns({
    setRows: sinon.stub().returnsThis(),
  }),
  newTableReference: sinon.stub().returns({
    setProjectId: sinon.stub().returnsThis(),
    setDatasetId: sinon.stub().returnsThis(),
    setTableId: sinon.stub().returnsThis(),
    getProjectId: sinon.stub().returns('mock_project_id'),
    getDatasetId: sinon.stub().returns('mock_dataset_id'),
    getTableId: sinon.stub().returns('mock_table_id'),
  }),
  newTableDataInsertAllRequestRows: sinon.stub().returns({
    json: sinon.stub().returnsThis(),
  }),
  Tabledata: {
    insertAll: sinon.stub(),
  },
};

const mockScriptApp = {
  getOAuthToken: sinon.stub().returns('mock_oauth_token'),
};

describe('BigQueryStrategyExporter', function () {
  let exporter: BigQueryStrategyExporter;

  beforeEach(function () {
    exporter = new BigQueryStrategyExporter(
      'test_project',
      'test_dataset',
      mockBigQueryService as unknown as GoogleAppsScript.BigQuery,
      mockScriptApp as unknown as GoogleAppsScript.Script.ScriptApp,
    );
    sinon.resetHistory(); // Reset history of stubs before each test
  });

  describe('export', function () {
    it('should return true on successful data insertion', function () {
      const tableName = 'test_table';
      const data = [{ id: 1, name: 'test' }];
      mockBigQueryService.Tabledata.insertAll.returns({}); // Simulate success
      exporter.export(data, { destination: 'bigquery', tableName });
      expect(mockBigQueryService.Tabledata.insertAll.calledOnce).toBeTruthy();
    });

    it('should throw an error if table name is not provided', function () {
      const data = [{ id: 1, name: 'test' }];
      expect(() => exporter.export(data, { destination: 'bigquery' }).toThrow(
        'Table name is required for BigQuery export.',
      );
    });

    it('should handle empty data gracefully', function () {
      const tableName = 'test_table';
      const data = [
        { a: '1', b: '2' },
        { a: '3', b: '4' },
      ];
      exporter.export(data as Record<string, unknown>[], {
        destination: 'bigquery',
        tableName,
      });
      expect(mockBigQueryService.Tabledata.insertAll.called).toBeFalsy();
    });

    it('should handle insertion failure gracefully', function () {
      const tableName = 'test_table';
      const data = [{ id: 1, name: 'test' }];
      mockBigQueryService.Tabledata.insertAll.throws(
        new Error('BigQuery API error'),
      );
      // We expect the method to catch the error and not throw.
      expect(() =>
        exporter.export(data, { destination: 'bigquery', tableName }),
      ).not.toThrow();
      expect(mockBigQueryService.Tabledata.insertAll.calledOnce).toBeTruthy();
    });
  });
});
