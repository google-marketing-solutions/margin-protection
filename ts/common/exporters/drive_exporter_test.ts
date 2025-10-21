/**
 * @fileoverview Unit tests for the DriveExporter class.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { DriveExporter } from './drive_exporter';
import {
  FOLDER,
  fakeFiles,
  mockAppsScript,
  tearDownStubs,
} from '../test_helpers/mock_apps_script';

describe('DriveExporter', function () {
  let exporter: DriveExporter;
  let oldDrive: GoogleAppsScript.Drive;
  let stubs: sinon.SinonStub[];

  beforeEach(function () {
    stubs = [sinon.stub(Utilities, 'newBlob')];
    mockAppsScript();
    exporter = new DriveExporter();
    oldDrive = Drive;
  });

  afterEach(function () {
    Drive = oldDrive;
    tearDownStubs(stubs);
  });

  it('saves the file', function () {
    const reportsFolder = {
      id: 'reports_folder_id',
      mimeType: FOLDER,
      title: 'reports',
    };
    fakeFiles.folders['your_folder_id'] = [reportsFolder];
    fakeFiles.files['reports'] = reportsFolder;
    exporter.export([['it works!']], {
      destination: 'drive',
      fileName: 'Acme Inc._my check_1970-01-01T00:00:00.000Z.csv',
    });
    const folderId = fakeFiles.files['reports'].id;
    expect(fakeFiles.folders[folderId!][0]).to.deep.include({
      mimeType: 'text/csv',
    });

    for (const value of [
      'Acme Inc.',
      'my check',
      '1970-01-01T00:00:00.000Z.csv',
    ]) {
      expect(Object.keys(fakeFiles.files)[1]).to.contain(value);
    }
  });
});
