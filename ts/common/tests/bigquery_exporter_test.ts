/**
 * @fileoverview Unit tests for the BigQueryExporter class.
 */

// ts/common/tests/bigquery_exporter_test.ts
import { expect } from 'chai';
import * as sinon from 'sinon';
import { BigQueryExporter } from '../bigquery_exporter';

describe('BigQueryExporter', () => {
  let exporter: BigQueryExporter;

  beforeEach(() => {
    exporter = new BigQueryExporter();
  });

  describe('authenticate', () => {
    it('should return true on successful authentication', () => {
      expect(exporter.authenticate()).to.be.true;
    });

    it('should return false on failed authentication', () => {
      expect(exporter.authenticate()).to.be.false;
    });
  });

  describe('insertData', () => {
    it('should return true on successful data insertion', () => {
      const tableName = 'test_table';
      const data = [{ id: 1, name: 'test' }];
      expect(exporter.insertData(tableName, data)).to.be.true;
    });

    it('should return false on failed data insertion', () => {
      const tableName = 'test_table';
      const data = [{ id: 1, name: 'test' }];
      expect(exporter.insertData(tableName, data)).to.be.false;
    });
  });
});
