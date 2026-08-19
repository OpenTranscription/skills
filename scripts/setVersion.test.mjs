import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { setVersion } from './setVersion.mjs';

let root;

const write = async (dir, manifest) => {
  await mkdir(join(root, dir), { recursive: true });
  await writeFile(
    join(root, dir, 'package.json'),
    JSON.stringify(manifest, null, 2)
  );
};

const read = async (dir) =>
  JSON.parse(await readFile(join(root, dir, 'package.json'), 'utf8'));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ot-setversion-'));
  await write('.', {
    name: '@opentranscription/workspace',
    private: true,
    version: '0.1.0',
    workspaces: ['packages/*'],
  });
  await write('packages/sdk', {
    name: '@opentranscription/sdk',
    version: '0.1.0',
  });
  await write('packages/cli', {
    name: '@opentranscription/cli',
    version: '0.1.0',
    dependencies: { '@opentranscription/sdk': '0.1.0' },
  });
});

describe('setVersion', () => {
  it('stamps the release version on every workspace package', async () => {
    await setVersion(root, '0.2.0');

    expect((await read('.')).version).toBe('0.2.0');
    expect((await read('packages/sdk')).version).toBe('0.2.0');
    expect((await read('packages/cli')).version).toBe('0.2.0');
  });

  /**
   * The CLI pins the SDK exactly. If the bump stamps versions but leaves the pin
   * behind, npm publishes a CLI whose dependency resolves to the PREVIOUS SDK —
   * so a command calling a brand-new SDK method throws at runtime for every
   * installing user, and nothing in CI notices, because the local workspace
   * symlink always resolves to the new code.
   */
  it('rewrites the internal dependency pin to the same version', async () => {
    await setVersion(root, '0.2.0');

    expect((await read('packages/cli')).dependencies).toEqual({
      '@opentranscription/sdk': '0.2.0',
    });
  });

  it('leaves third-party dependencies alone', async () => {
    await write('packages/cli', {
      name: '@opentranscription/cli',
      version: '0.1.0',
      dependencies: { '@opentranscription/sdk': '0.1.0', undici: '^7.0.0' },
    });

    await setVersion(root, '0.2.0');

    expect((await read('packages/cli')).dependencies.undici).toBe('^7.0.0');
  });

  it('refuses a version that is not semver, rather than writing garbage', async () => {
    await expect(setVersion(root, 'next')).rejects.toThrow(/semver/i);
    expect((await read('packages/sdk')).version).toBe('0.1.0');
  });
});
