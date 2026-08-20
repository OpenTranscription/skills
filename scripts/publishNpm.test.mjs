import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { NPM_PACKAGES, npmCommand, publishNpm } from './publishNpm.mjs';

/**
 * A fake `npm`, recording what it was asked to do.
 *
 * `onView` decides what the registry claims to already have: return a version
 * string for "published", an empty string for "package exists, version does
 * not", or throw for the E404 a never-published package gives.
 */
const fakeNpm = ({ onView = () => '', onPublish = () => '' } = {}) => {
  const calls = [];
  const exec = async (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    // By name, not by index: the real command can carry an npm-cli.js prefix
    // ahead of the subcommand, and a positional fake would only ever agree with
    // whichever platform wrote it.
    const at = args.findIndex((a) => a === 'view' || a === 'publish');
    if (args[at] === 'view')
      return { stdout: onView(args[at + 1]), stderr: '' };
    return { stdout: onPublish(args[at + 1]), stderr: '' };
  };
  // `npm` pinned so these assert behaviour, not the machine they run on.
  return { exec, calls, log: () => {}, npm: ['npm', []] };
};

const publishes = (calls) =>
  calls.filter((c) => c.includes('publish')).map((c) => c.split(' -w ')[1]);

describe('publishNpm', () => {
  it('publishes every package when the registry has none of them', async () => {
    const npm = fakeNpm({
      onView: () => {
        throw new Error('E404');
      },
    });

    const done = await publishNpm('0.3.0', npm);

    expect(done).toEqual(NPM_PACKAGES);
    expect(publishes(npm.calls)).toEqual(NPM_PACKAGES);
  });

  /**
   * The wedge this exists to undo.
   *
   * `@semantic-release/git` pushes the release commit BEFORE publishing, and
   * semantic-release only tags on full success. So a run that published `sdk`
   * and then failed on `cli` leaves no tag, the next run recomputes the SAME
   * version, and a plain `npm publish && npm publish` dies on `sdk` — the one
   * that already succeeded — without ever reaching the one that did not.
   */
  it('skips a package the registry already has and still publishes the rest', async () => {
    const npm = fakeNpm({
      onView: (spec) =>
        spec.startsWith('@opentranscription/sdk@') ? '0.3.0' : '',
    });

    const done = await publishNpm('0.3.0', npm);

    expect(done).toEqual(['@opentranscription/cli']);
    expect(publishes(npm.calls)).toEqual(['@opentranscription/cli']);
  });

  it('does nothing when the whole release is already on the registry', async () => {
    const npm = fakeNpm({ onView: () => '0.3.0' });

    expect(await publishNpm('0.3.0', npm)).toEqual([]);
    expect(publishes(npm.calls)).toEqual([]);
  });

  /**
   * A known package whose requested version does not exist yet exits 0 and
   * prints nothing. Reading the exit code alone would call that "published" and
   * skip the release entirely, which fails silently rather than loudly.
   */
  it('treats empty output as not published, not as success', async () => {
    const npm = fakeNpm({ onView: () => '   \n' });

    expect(await publishNpm('0.3.0', npm)).toEqual(NPM_PACKAGES);
  });

  /**
   * The narrower wedge the first fix opened.
   *
   * Treating EVERY `npm view` failure as "not published" means a transient
   * registry error on a re-run — a 429, a DNS blip, a proxy timeout — reads as
   * "publish it", npm rejects the duplicate version, and the chain dies on the
   * package that already succeeded. That is the original bug again, just with
   * a flakier trigger. Only a genuine E404 may mean "not published".
   */
  it('aborts on a registry error rather than guessing that nothing is published', async () => {
    const npm = fakeNpm({
      onView: () => {
        throw new Error(
          'npm ERR! network request to https://registry.npmjs.org failed'
        );
      },
    });

    await expect(publishNpm('0.3.0', npm)).rejects.toThrow(
      /could not determine/i
    );
    expect(publishes(npm.calls)).toEqual([]);
  });

  it('reads a real E404 as not published and goes ahead', async () => {
    const npm = fakeNpm({
      onView: () => {
        throw new Error(
          'npm ERR! code E404\nnpm ERR! 404 Not Found - GET https://registry.npmjs.org/...'
        );
      },
    });

    expect(await publishNpm('0.3.0', npm)).toEqual(NPM_PACKAGES);
  });

  it('lets a real publish failure through instead of swallowing it', async () => {
    const npm = fakeNpm({
      onPublish: () => {
        throw new Error('EOTP: one-time password required');
      },
    });
    const exec = async (cmd, args) => {
      if (args[0] === 'view') return { stdout: '', stderr: '' };
      throw new Error('EOTP: one-time password required');
    };

    await expect(publishNpm('0.3.0', { ...npm, exec })).rejects.toThrow(/EOTP/);
  });

  it('never shells out: every call is an argv array', async () => {
    // The version reaches this from semantic-release. execFile with an argument
    // array means no shell parses it, so there is nothing to inject into.
    const seen = [];
    const exec = async (cmd, args) => {
      seen.push({ cmd, args });
      return { stdout: '', stderr: '' };
    };

    await publishNpm('0.3.0', { exec, log: () => {} });

    for (const { cmd, args } of seen) {
      // Which binary is `npmCommand`'s business. What matters here is that
      // arguments arrive as an array, so no shell ever parses the version, and
      // that nothing being run is a batch wrapper.
      expect(Array.isArray(args)).toBe(true);
      for (const part of [cmd, ...args]) {
        expect(part).not.toMatch(/\.(cmd|bat)$/i);
      }
    }
  });
});

/**
 * Running npm from Node without a shell.
 *
 * On Windows npm is `npm.cmd`, and since the CVE-2024-27980 fix Node refuses to
 * execFile a `.cmd` at all: bare `npm` gives ENOENT, `npm.cmd` gives EINVAL.
 * The usual advice is `shell: true`, which puts an interpolated version string
 * back in front of a shell for a script whose whole job is publishing.
 *
 * `npm.cmd` is a two-line wrapper that runs node against `npm-cli.js`, so
 * calling that file with `process.execPath` skips the wrapper, needs no shell,
 * and is the same on every platform.
 */
describe('npmCommand', () => {
  const NODE = '/opt/node/bin/node';

  it('prefers the npm-cli.js that npm itself points at', () => {
    const [cmd, prefix] = npmCommand(
      { npm_execpath: '/global/npm/bin/npm-cli.js' },
      NODE,
      (p) => p === '/global/npm/bin/npm-cli.js'
    );

    expect(cmd).toBe(NODE);
    expect(prefix).toEqual(['/global/npm/bin/npm-cli.js']);
  });

  it('ignores an npm_execpath that is a shell wrapper rather than a script', () => {
    // Older npm and some installers set this to the .cmd. Running THAT through
    // node is exactly the EINVAL this avoids.
    const [cmd] = npmCommand(
      { npm_execpath: 'C:\npm\npm.cmd' },
      NODE,
      () => true
    );

    expect(cmd).not.toBe('C:\npm\npm.cmd');
  });

  it('falls back to the npm bundled beside the running node', () => {
    const bundled = join(
      dirname(NODE),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    );

    const [cmd, prefix] = npmCommand({}, NODE, (p) => p === bundled);

    expect(cmd).toBe(NODE);
    expect(prefix).toEqual([bundled]);
  });

  it('falls back to bare npm when no script can be found', () => {
    // The POSIX case where npm is simply on PATH, which is what CI hits.
    expect(npmCommand({}, NODE, () => false)).toEqual(['npm', []]);
  });

  it('never returns a .cmd or .bat, whatever the environment claims', () => {
    for (const wrapper of ['C:\npm\npm.cmd', 'C:\npm\npm.bat']) {
      const [cmd, prefix] = npmCommand(
        { npm_execpath: wrapper },
        NODE,
        () => true
      );
      for (const part of [cmd, ...prefix]) {
        expect(part).not.toMatch(/\.(cmd|bat)$/i);
      }
    }
  });
});
