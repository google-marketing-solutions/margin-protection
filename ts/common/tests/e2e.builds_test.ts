/**
 * Copyright 2025 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with a copy of the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  expect,
  vi,
  describe,
  beforeAll,
  test,
  it,
  afterAll,
  beforeEach,
} from 'vitest';
import { mockAppsScript } from '../test_helpers/mock_apps_script.js';
import { preBuild, buildPackage } from '../build.js';
import { stubNamedRanges } from './helpers.js';

const __dirname = import.meta.dirname;

vi.mock('fs/promises', async () => {
  const { nodeFs } = (await vi.importActual(
    '@file-services/node',
  )) as typeof import('@file-services/node');
  const { createMemoryFs } = (await vi.importActual(
    '@file-services/memory',
  )) as typeof import('@file-services/memory');
  const { createOverlayFs } = (await vi.importActual(
    '@file-services/overlay',
  )) as typeof import('@file-services/overlay');
  const path = (await vi.importActual('path')) as typeof import('path');

  const paths = path.resolve(import.meta.dirname, '..', '..');
  const sa360Version = path.resolve(paths, 'sa360', 'src', 'version.ts');
  const dv360Version = path.resolve(paths, 'dv360', 'src', 'version.ts');
  const memFs = createMemoryFs({
    [sa360Version]: '',
    [dv360Version]: '',
  });
  const overlayFs = createOverlayFs(nodeFs, memFs);
  return overlayFs.promises;
});

describe('E2E Build Tests', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime('2025-01-01T14:01:30Z');
  });
  afterAll(() => {
    vi.unmock('fs');
    vi.useRealTimers();
  });

  describe('DV360 Package', () => {
    let projectRoot: string;
    let dv360Root: string;
    let distPath: string;

    beforeAll(async () => {
      projectRoot = path.resolve(__dirname, '..', '..');
      dv360Root = path.join(projectRoot, 'dv360');
      distPath = path.join(dv360Root, 'dist');

      await preBuild('dv360', projectRoot);
      await buildPackage('dv360', projectRoot);
    }, 20000);

    test('should build the dv360 package into an in-memory dist directory', () => {
      expect(fs.access(distPath)).resolves.toBeUndefined();
    });

    it('should have the expected file structure', async () => {
      const files = await fs.readdir(distPath);
      const includedValues = [
        'main.js',
        'appsscript.json',
        'functions.mjs',
        'html',
        'version.js',
      ];
      expect(files.sort()).toEqual(includedValues.sort());
    });

    describe('Black-box tests for the built dv360 package', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let context: any;

      beforeEach(async () => {
        const paths = path.resolve(import.meta.dirname, '..', '..');
        const dv360Version = path.resolve(paths, 'dv360', 'src', 'version.ts');
        await fs.writeFile(dv360Version, '');
        mockAppsScript();
        stubNamedRanges({
          ENTITY_ID: 'A1',
          ID_TYPE: 'Advertiser',
          LABEL: 'label',
          EMAIL_LIST: '',
        });
      });

      it('should define a VERSION global in datever format', async () => {
        context = await bootstrapE2eTest(distPath, 'DisplayVideoFrontend');

        expect(context.CURRENT_SHEET_VERSION).toEqual('20250101.14.0');
      });

      it('should define all public API functions on the global object', async () => {
        context = await bootstrapE2eTest(distPath, 'DisplayVideoFrontend');

        expect(context.onOpen).toBeInstanceOf(Function);
        expect(context.initializeSheets).toBeInstanceOf(Function);
        expect(context.initializeRules).toBeInstanceOf(Function);
        expect(context.preLaunchQa).toBeInstanceOf(Function);
        expect(context.launchMonitor).toBeInstanceOf(Function);
        expect(context.displaySetupModal).toBeInstanceOf(Function);
        expect(context.displayGlossary).toBeInstanceOf(Function);
        expect(context.CURRENT_SHEET_VERSION).toBeTruthy();
      });

      it('should call real functions, not the empty function in functions.mjs', async () => {
        context = await bootstrapE2eTest(distPath, 'DisplayVideoFrontend');
        const consoleLogSpy = vi.spyOn(console, 'log');

        context.onOpen();
        context.initializeSheets();
        context.preLaunchQa();
        context.launchMonitor();

        expect(consoleLogSpy).toBeCalledWith('ON OPEN CALLED');
        expect(consoleLogSpy).toBeCalledWith('INITIALIZE SHEETS CALLED');
        expect(consoleLogSpy).toBeCalledWith('PRE-LAUNCH-QA CALLED');
        expect(consoleLogSpy).toBeCalledWith('LAUNCH MONITOR CALLED');
      });

      it('has expected client args', () => {
        context.initializeSheets();

        expect(context.frontendArgs.client.args).toEqual({
          id: 'A1',
          idType: 1,
          label: 'label',
        });
      });
    });
  });

  describe('SA360 Package', () => {
    let projectRoot: string;
    let sa360Root: string;
    let distPath: string;

    beforeAll(async () => {
      projectRoot = path.resolve(__dirname, '..', '..');
      sa360Root = path.join(projectRoot, 'sa360');
      distPath = path.join(sa360Root, 'dist');

      await preBuild('sa360', projectRoot);
      await buildPackage('sa360', projectRoot);
    }, 20000);

    test('should build the sa360 package into an in-memory dist directory', () => {
      expect(fs.access(distPath)).resolves.toBeUndefined();
    });

    it('should have the expected file structure', async () => {
      const files = await fs.readdir(distPath);
      const includedValues = [
        'main.js',
        'appsscript.json',
        'html',
        'functions.mjs',
        'version.js',
      ];
      expect(files.sort()).toEqual(includedValues.sort());
    });

    describe('Black-box tests for the built sa360 package', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let context: any;

      beforeEach(async () => {
        const paths = path.resolve(import.meta.dirname, '..', '..');
        const sa360Version = path.resolve(paths, 'sa360', 'src', 'version.ts');
        await fs.writeFile(sa360Version, '');
        mockAppsScript();
        stubNamedRanges({
          LOGIN_CUSTOMER_ID: '12345',
          CUSTOMER_IDS: '111,222,333',
          LABEL: 'label',
          FULL_FETCH: '',
          EMAIL_LIST: '',
        });
      });

      it('should define all public API functions on the global object', async () => {
        context = await bootstrapE2eTest(distPath, 'SearchAdsFrontend');

        expect(context.onOpen).toBeInstanceOf(Function);
        expect(context.initializeSheets).toBeInstanceOf(Function);
        expect(context.initializeRules).toBeInstanceOf(Function);
        expect(context.preLaunchQa).toBeInstanceOf(Function);
        expect(context.launchMonitor).toBeInstanceOf(Function);
        expect(context.displaySetupModal).toBeInstanceOf(Function);
        expect(context.displayGlossary).toBeInstanceOf(Function);
      });

      it('should define a VERSION global in datever format', async () => {
        expect(context.CURRENT_SHEET_VERSION).toEqual('20250101.14.0');
      });

      it('should call real functions, not the empty function in functions.mjs', async () => {
        const consoleLogSpy = vi.spyOn(console, 'log');
        context = await bootstrapE2eTest(distPath, 'SearchAdsFrontend');

        context.onOpen();
        context.initializeSheets();
        context.preLaunchQa();
        context.launchMonitor();

        expect(consoleLogSpy).toBeCalledWith('ON OPEN CALLED');
        expect(consoleLogSpy).toBeCalledWith('INITIALIZE SHEETS CALLED');
        expect(consoleLogSpy).toBeCalledWith('PRE-LAUNCH-QA CALLED');
        expect(consoleLogSpy).toBeCalledWith('LAUNCH MONITOR CALLED');
      });

      it('has expected client args', async () => {
        context = await bootstrapE2eTest(distPath, 'SearchAdsFrontend');
        context.initializeSheets();

        expect(context.frontendArgs.client.args).toEqual({
          customerIds: '111,222,333',
          label: 'label',
          loginCustomerId: '12345',
        });
      });
    });
  });
});

function getFakeClass() {
  return `
class FakeFrontend extends AppsScriptFrontend {
  initializeSheets() {
    console.log('INITIALIZE SHEETS CALLED');
    global.frontendArgs = this;
  }

  preLaunchQa() {
    console.log('PRE-LAUNCH-QA CALLED');
  }

  launchMonitor() {
    console.log('LAUNCH MONITOR CALLED');
  }

  onOpen() {
    console.log('ON OPEN CALLED');
  }

  getIdentity() {
    return {'identity': 'user@somewhere.com'}; 
  }

}
`;
}

async function bootstrapE2eTest(distDir: string, frontendClassName: string) {
  const content: string[] = [];
  const globSearchString = [`${distDir}/*.mjs`, `${distDir}/*.js`];
  console.log(globSearchString);

  for await (const file of fs.glob(globSearchString)) {
    content.push(await fs.readFile(file, 'utf-8'));
  }
  const concatenatedContent = content.join('\n');
  expect(concatenatedContent).toContain(
    `var ${frontendClassName} = class extends AppsScriptFrontend {`,
  );
  const finalContent = concatenatedContent.replace(
    `var ${frontendClassName} = class extends AppsScriptFrontend {`,
    getFakeClass().concat(
      `\n\nvar ${frontendClassName} = class extends FakeFrontend {`,
    ),
  );
  const context = Object.assign({}, globalThis);

  new Function(finalContent).call(context);
  return context;
}
