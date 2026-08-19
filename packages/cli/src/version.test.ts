import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { cliVersion } from './version.js';

describe('cliVersion', () => {
  /**
   * `ot --version` is what someone pastes into a bug report. A hardcoded string
   * is right exactly once — on the next `npm version` bump it starts lying, and
   * nothing in the build catches it. Read the manifest that npm actually ships.
   */
  it('matches the version npm publishes', async () => {
    const manifest = JSON.parse(
      await readFile(
        fileURLToPath(new URL('../package.json', import.meta.url)),
        'utf8'
      )
    ) as { version: string };

    expect(cliVersion()).toBe(manifest.version);
  });
});
