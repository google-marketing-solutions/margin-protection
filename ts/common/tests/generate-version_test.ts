/**
 * @license
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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getNextVersion, writeVersionFile } from '../generate-version.js';
import { projectRoot } from '#common/utils.js';

const hoisted = vi.hoisted(async () => {
  const projectRoot = '/test-project';
  const { createMemoryFs } = (await vi.importActual(
    '@file-services/memory',
  )) as typeof import('@file-services/memory');

  const memoryFs = createMemoryFs({
    [projectRoot]: {
      sa360: {
        src: {},
      },
      dv360: {
        src: {},
      },
    },
  });
  return { memoryFs, projectRoot };
});

vi.mock('#common/utils.js', async () => {
  const projectRoot = (await hoisted).projectRoot;
  return { projectRoot };
});
vi.mock('fs/promises', async () => {
  return (await hoisted).memoryFs.promises;
});

describe('getVersion', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    // Ensure the fake directory exists
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should start at patch 0 if no version file exists', async () => {
    const date = new Date(1999, 11, 31, 5); // 5 AM
    vi.setSystemTime(date);

    const version = await getNextVersion('sa360');
    expect(version).toBe('19991231.5.0');
  });

  it('should increment patch if hour is the same', async () => {
    const date = new Date(1999, 11, 31, 5); // 5 AM
    vi.setSystemTime(date);

    // Write an initial version file.
    await writeVersionFile('sa360', '19991231.5.2', projectRoot);

    const version = await getNextVersion('sa360');
    expect(version).toBe('19991231.5.3');
  });

  it('should reset patch to 0 if hour is different', async () => {
    const date = new Date(1999, 11, 31, 6); // 6 AM
    vi.setSystemTime(date);

    // Write an initial version file from the previous hour.
    await writeVersionFile('sa360', '19991231.5.3', projectRoot);

    const version = await getNextVersion('sa360');
    expect(version).toBe('19991231.6.0');
  });

  it('should reset patch to 0 if day is different', async () => {
    const date = new Date(2000, 0, 1, 0); // Midnight, Jan 1st 2000
    vi.setSystemTime(date);

    // Write an initial version file from the previous day.
    await writeVersionFile('sa360', '19991231.23.5', projectRoot);

    const version = await getNextVersion('sa360');
    expect(version).toBe('20000101.0.0');
  });
});
