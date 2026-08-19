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

const readManifest = async (dir) =>
  JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));

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
    await Promise.all(
      packageDirs.map(async (dir) => (await readManifest(dir)).name)
    )
  );

  for (const dir of [root, ...packageDirs]) {
    const manifest = await readManifest(dir);
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
