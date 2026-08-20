import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const NPM_PACKAGES = [
  '@opentranscription/sdk',
  '@opentranscription/cli',
];

/** A registry answer of "no such package or version", as opposed to any other failure. */
const isNotFound = (error) =>
  /E404|404 Not Found/i.test(
    `${error?.stderr ?? ''}${error?.stdout ?? ''}${error?.message ?? ''}`
  );

/**
 * Ask the registry whether this exact version is already there.
 *
 * `npm view <pkg>@<version> version` prints the version when it exists and
 * exits non-zero with E404 when the PACKAGE is unknown. A known package with an
 * unknown version exits 0 and prints nothing, which is why this checks the
 * output rather than the exit code alone.
 *
 * ONLY an E404 counts as "not published". Reading every failure that way
 * rebuilds the wedge this file exists to prevent: on a re-run, a transient
 * registry error (a 429, a DNS blip, a proxy timeout) would report "not
 * published" for a package that IS published, npm would reject the duplicate
 * version, and the chain would die on the package that already succeeded.
 * Anything else is unknown, and unknown aborts before publishing anything.
 */
const isPublished = async (pkg, version, exec) => {
  try {
    const { stdout } = await exec('npm', [
      'view',
      `${pkg}@${version}`,
      'version',
    ]);
    return stdout.trim().length > 0;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw new Error(
      `could not determine whether ${pkg}@${version} is published: ${error?.message ?? error}`,
      { cause: error }
    );
  }
};

/**
 * Publish every npm package at `version`, skipping any the registry already has.
 *
 * The skip is the whole point. `@semantic-release/git` pushes the release commit
 * BEFORE publishing, and semantic-release only tags on full success, so a chain
 * that publishes `sdk` and then fails on `cli` leaves no tag: the next run
 * recomputes the SAME version, re-runs this command, and a plain
 * `npm publish && npm publish` dies on the first package because that version is
 * already on the registry. The release wedges with one package published, one
 * not, and PyPI never attempted. npm versions cannot be replaced, only
 * deprecated, so the only recovery was manual.
 *
 * Skipping what is already there makes a re-run finish the job instead.
 */
export const publishNpm = async (
  version,
  { exec = run, log = console.log } = {}
) => {
  const published = [];

  for (const pkg of NPM_PACKAGES) {
    if (await isPublished(pkg, version, exec)) {
      log(`${pkg}@${version} is already on the registry, skipping`);
      continue;
    }

    await exec('npm', ['publish', '-w', pkg]);
    log(`published ${pkg}@${version}`);
    published.push(pkg);
  }

  return published;
};
