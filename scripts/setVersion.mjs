import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

/** The manifest, or `null` for a `packages/*` entry that is not an npm package. */
const readManifest = async (dir) => {
  const source = await readFile(join(dir, 'package.json'), 'utf8').catch(
    () => null
  );
  return source === null ? null : JSON.parse(source);
};

/**
 * Stamp the version into a pyproject.toml, if the directory has one.
 *
 * Scoped to the `[project]` table rather than swept across the file: a bare
 * `version = "..."` replace also rewrites `requires-python`, a dependency pin,
 * and any `[tool.*]` block that happens to carry a version, which would publish
 * a package demanding httpx 0.2.0.
 *
 * Absent means absent, but PRESENT AND UNSTAMPABLE THROWS. Those two used to
 * share one `false`, so a file this could not parse left PyPI on the previous
 * version while every package.json bumped, and the release published anyway.
 */
const stampPyproject = async (dir, version) => {
  const path = join(dir, 'pyproject.toml');
  const source = await readFile(path, 'utf8').catch(() => null);
  if (source === null) return false;

  // Anchored to the start of a line: a plain substring search matches a comment
  // that merely mentions `[project]`, and everything after that reads the wrong
  // slice of the file.
  //
  // The trailing `#...` is not decoration. TOML allows a comment on the header
  // line, and requiring bare end-of-line here would throw on `[project] # PEP
  // 621` — a valid file the loose search handled — aborting a whole release
  // over punctuation. Closing one hole this way opens a narrower, louder one.
  const header = /^\[project\][ \t]*(#.*)?$/m.exec(source);
  if (header === null) {
    // Reached only when the file exists. A package whose pyproject.toml is
    // legacy-format (say `[tool.poetry]` with no `[project]` table) would stop
    // the release here even though it was never meant to be stamped; the day
    // that package exists, skip it explicitly rather than loosening this.
    throw new Error(`${path} has no [project] table to stamp`);
  }

  const start = header.index;
  const afterHeader = start + header[0].length;
  const nextTable = source.slice(afterHeader).search(/^\[/m);
  const end = nextTable === -1 ? source.length : afterHeader + nextTable;

  const table = source.slice(start, end);
  // TOML allows single quotes, and a `version = '...'` this cannot rewrite must
  // be loud rather than skipped.
  const stamped = table.replace(
    /^version\s*=\s*"[^"]*"/m,
    `version = "${version}"`
  );
  if (stamped === table) {
    throw new Error(
      `${path} has no [project] version = "..." line this can stamp`
    );
  }

  await writeFile(path, source.slice(0, start) + stamped + source.slice(end));
  return true;
};

/**
 * Stamp one release version across the workspace, and keep every INTERNAL
 * dependency pin pointing at it.
 *
 * The pin matters more than the version fields. `@opentranscription/cli` depends
 * on `@opentranscription/sdk` by exact version, so a bump that updates versions
 * but not the pin publishes a CLI wired to the previous SDK. Locally that is
 * invisible — npm workspaces symlink the sibling regardless of the pin — and it
 * only breaks for people who install from the registry.
 */
export const setVersion = async (root, version) => {
  if (!SEMVER.test(version)) {
    throw new Error(`Not a semver version: ${version}`);
  }

  const packagesDir = join(root, 'packages');
  const entries = await readdir(packagesDir, { withFileTypes: true }).catch(
    () => []
  );
  const packageDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesDir, entry.name));

  const internal = new Set(
    (await Promise.all(packageDirs.map(async (dir) => await readManifest(dir))))
      .filter(Boolean)
      .map((manifest) => manifest.name)
  );

  for (const dir of packageDirs) {
    await stampPyproject(dir, version);
  }

  for (const dir of [root, ...packageDirs]) {
    const manifest = await readManifest(dir);
    if (manifest === null) continue;
    manifest.version = version;

    for (const field of DEPENDENCY_FIELDS) {
      const deps = manifest[field];
      if (!deps) continue;
      for (const name of Object.keys(deps)) {
        if (internal.has(name)) deps[name] = version;
      }
    }

    await writeFile(
      join(dir, 'package.json'),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
  }

  return version;
};
