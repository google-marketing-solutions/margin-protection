/**
 * @fileoverview Unit tests for the BigQueryStrategyExporter class.
 */

import { expect } from 'chai';
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
      expect(mockBigQueryService.Tabledata.insertAll.calledOnce).to.be.true;
    });

    it('should throw an error if table name is not provided', function () {
      const data = [{ id: 1, name: 'test' }];
      expect(() => exporter.export(data, { destination: 'bigquery' })).to.throw(
        'Table name is required for BigQuery export.',
      );
    });
  });
});
