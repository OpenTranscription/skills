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

/**
 * `packages/*` is no longer all npm. `packages/sdk-python` has a pyproject.toml
 * and no package.json, and the release stamps one version across every client
 * so a reader comparing `pip show` to `npm ls` sees the same number.
 *
 * These would have failed only during a release, in CI, after the commit that
 * broke them had already merged.
 */
describe('setVersion across a polyglot workspace', () => {
  const writePyproject = async (body) => {
    await mkdir(join(root, 'packages/sdk-python'), { recursive: true });
    await writeFile(join(root, 'packages/sdk-python/pyproject.toml'), body);
  };

  const readPyproject = () =>
    readFile(join(root, 'packages/sdk-python/pyproject.toml'), 'utf8');

  it('does not crash on a package directory that has no package.json', async () => {
    await writePyproject(
      '[project]\nname = "opentranscription"\nversion = "0.1.0"\n'
    );

    await expect(setVersion(root, '0.2.0')).resolves.toBe('0.2.0');
    expect((await read('packages/sdk')).version).toBe('0.2.0');
  });

  it('stamps the release version into pyproject.toml', async () => {
    await writePyproject(
      '[project]\nname = "opentranscription"\nversion = "0.1.0"\n'
    );

    await setVersion(root, '0.2.0');

    expect(await readPyproject()).toContain('version = "0.2.0"');
  });

  /**
   * The dangerous edit. A bare /version = "..."/ sweep also rewrites a
   * dependency pin and the build backend's own version, publishing a package
   * that demands httpx 0.2.0. Only the [project] table's own version is ours.
   */
  it('rewrites only the project version, never a pin that looks like one', async () => {
    await writePyproject(
      [
        '[build-system]',
        'requires = ["hatchling"]',
        '',
        '[project]',
        'name = "opentranscription"',
        'version = "0.1.0"',
        'requires-python = ">=0.1.0"',
        'dependencies = ["httpx>=0.1.0"]',
        '',
        '[tool.example]',
        'version = "0.1.0"',
        '',
      ].join('\n')
    );

    await setVersion(root, '0.2.0');
    const toml = await readPyproject();

    expect(toml).toContain('version = "0.2.0"');
    expect(toml).toContain('requires-python = ">=0.1.0"');
    expect(toml).toContain('dependencies = ["httpx>=0.1.0"]');
    expect(toml).toContain('[tool.example]\nversion = "0.1.0"');
  });

  /**
   * The dangerous silence. `stampPyproject` can decline for three reasons and
   * the caller cannot tell "no pyproject here" from "there is one and I failed
   * to stamp it". If it fails quietly, every package.json bumps, the release
   * publishes, and PyPI gets the PREVIOUS version number or a duplicate.
   */
  it('throws when a pyproject.toml exists but has no stampable version', async () => {
    await writePyproject('[project]\nname = "opentranscription"\n');

    await expect(setVersion(root, '0.2.0')).rejects.toThrow(/pyproject/i);
  });

  it('throws rather than skip a version it cannot recognise', async () => {
    // Single quotes are legal TOML and the regex only reads double quotes.
    await writePyproject(
      '[project]\nname = "opentranscription"\nversion = \'0.1.0\'\n'
    );

    await expect(setVersion(root, '0.2.0')).rejects.toThrow(/pyproject/i);
  });

  /**
   * `[project]` was found with a bare substring search, so a comment mentioning
   * it matched first and the real table was never reached.
   */
  it('is not fooled by a comment that mentions the project table', async () => {
    await writePyproject(
      [
        '# the [project] table below is what ships',
        '[project]',
        'name = "opentranscription"',
        'version = "0.1.0"',
        '',
      ].join('\n')
    );

    await setVersion(root, '0.2.0');

    expect(await readPyproject()).toContain('version = "0.2.0"');
  });

  /**
   * Anchoring the header to end-of-line closed the "a comment mentions
   * [project]" hole and opened a narrower one: a comment ON the header line is
   * valid TOML, and the stricter match now throws on a file the loose one
   * handled, aborting the whole release.
   */
  it('accepts a trailing comment on the table header, which TOML allows', async () => {
    await writePyproject(
      [
        '[project]  # PEP 621',
        'name = "opentranscription"',
        'version = "0.1.0"',
        '',
      ].join('\n')
    );

    await setVersion(root, '0.2.0');

    expect(await readPyproject()).toContain('version = "0.2.0"');
  });

  /**
   * The header match ends in `$`, and this repo is developed on Windows, so
   * whether `$` sits before a bare `\r` decides if a checked-out file stamps at
   * all. It does — a JS regex treats CR as a line terminator in its own right,
   * not only as half of a CRLF pair — but that is regex theory, and CRLF has
   * already produced two false conclusions in this codebase. Cheaper to pin it.
   */
  it('stamps a file with CRLF line endings, comment and all', async () => {
    await writePyproject(
      [
        '[project]  # PEP 621',
        'name = "opentranscription"',
        'version = "0.1.0"',
        '',
      ].join('\r\n')
    );

    await setVersion(root, '0.2.0');

    expect(await readPyproject()).toContain('version = "0.2.0"');
  });

  it('refuses a bad version before touching pyproject.toml', async () => {
    await writePyproject(
      '[project]\nname = "opentranscription"\nversion = "0.1.0"\n'
    );

    await expect(setVersion(root, 'next')).rejects.toThrow(/semver/i);
    expect(await readPyproject()).toContain('version = "0.1.0"');
  });
});
