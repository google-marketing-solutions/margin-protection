/**
 * @fileoverview Unit tests for the ExportContext class.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { ExportContext, Exporter, ExportOptions } from './exporter';

class MockExporter implements Exporter {
  export(): void {
    // Mock implementation
  }
}

describe('ExportContext', function () {
  it('should call the export method of the strategy', function () {
    const mockExporter = new MockExporter();
    const exportSpy = sinon.spy(mockExporter, 'export');
    const context = new ExportContext(mockExporter);
    const data = [{ id: 1, name: 'test' }];
    const options: ExportOptions = {
      destination: 'drive',
      fileName: 'test.csv',
    };

    context.export(data, options);

    expect(exportSpy.calledOnceWith(data, options)).to.be.true;
  });
});
