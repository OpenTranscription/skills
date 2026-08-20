import { describe, expect, it } from 'vitest';

import { NPM_PACKAGES, publishNpm } from './publishNpm.mjs';

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
    if (args[0] === 'view') return { stdout: onView(args[1]), stderr: '' };
    return { stdout: onPublish(args[2]), stderr: '' };
  };
  return { exec, calls, log: () => {} };
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
      expect(cmd).toBe('npm');
      expect(Array.isArray(args)).toBe(true);
    }
  });
});
