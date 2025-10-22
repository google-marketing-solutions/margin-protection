/**
 * @fileoverview Unit tests for the ExportContext class.
 */

import { describe, expect, it, vi } from 'vitest';
import { ExportContext, Exporter, ExportOptions } from './exporter.js';

class MockExporter implements Exporter {
  export(): void {
    // Mock implementation
  }
}

describe('ExportContext', function () {
  it('should call the export method of the strategy', function () {
    const mockExporter = new MockExporter();
    const exportSpy = vi.spyOn(mockExporter, 'export');
    const context = new ExportContext(mockExporter);
    const data = [{ id: 1, name: 'test' }];
    const options: ExportOptions = {
      destination: 'drive',
      fileName: 'test.csv',
    };

    context.export(data, options);

    expect(exportSpy.mock.lastCall).toEqual([data, options]);
  });
});
