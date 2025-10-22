/**
 * @fileoverview Unit tests for the DriveExporter class.
 */

import { expect, afterEach, beforeEach, describe, it } from 'vitest';
import { DriveExporter } from './drive_exporter.js';
import { FOLDER, mockAppsScript } from '../test_helpers/mock_apps_script.js';

describe('DriveExporter', () => {
  let exporter: DriveExporter;

  beforeEach(() => {
    mockAppsScript();
    exporter = new DriveExporter();
  });

  afterEach(() => {
    // This is not strictly necessary with the new mock, but good practice.
  });

  it('saves the file to the specified Drive folder', () => {
    // ARRANGE
    // Create a folder where the file will be saved, using the v3 `name` property.
    const reportsFolder = Drive.Files.create({
      name: 'Reports',
      mimeType: FOLDER,
    });
    const folderId = reportsFolder.id!;
    const fileName = 'Acme Inc._my check_1970-01-01T00:00:00.000Z.csv';

    // ACT
    exporter.export([['it works!']], {
      destination: 'drive',
      fileName,
      folderId,
    });

    // ASSERT
    // Verify that a new file was created in the correct folder.
    const filesInFolder = Drive.Files.list({ q: `'${folderId}' in parents` });

    expect(filesInFolder.files).toBeDefined();
    expect(filesInFolder.files.length).toBe(1);

    const newFile = filesInFolder.files[0];
    expect(newFile.name).toEqual(fileName);
    expect(newFile.mimeType).toEqual('text/csv');
  });
});
