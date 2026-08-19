/**
 * On-disk credential store: one API key per organization.
 *
 * NOT one key. `api_keys.organization_id` is fixed when the key is minted and
 * there is no per-request org selector on the API-key path, so a key cannot be
 * pointed at a different org. A single stored key plus a `--org` flag would
 * therefore authenticate successfully and act on the WRONG org — silently, with
 * a valid credential. The map is what makes `--org` mean anything, and every
 * lookup for a named org fails closed.
 */

import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type StoredCredential = {
  apiKey: string;
  organizationName: string | null;
  scopes: string[];
};

export type CredentialStore = {
  version: 1;
  defaultOrgId: string | null;
  orgs: Record<string, StoredCredential>;
};

export type ResolveOptions = {
  /** From `--org`, `OT_ORG_ID`, or `.ot.json`. */
  orgId?: string | undefined;
};

const FILE_NAME = 'credentials.json';

/** No credential for the org the caller asked for. Never a fallback. */
export class MissingCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingCredentialError';
  }
}

/** `~/.config/opentranscription`, or `$OT_CONFIG_DIR` when set. */
export const defaultConfigDir = (): string =>
  process.env.OT_CONFIG_DIR ??
  join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'opentranscription'
  );

const empty = (): CredentialStore => ({
  version: 1,
  defaultOrgId: null,
  orgs: {},
});

export const loadCredentials = async (
  dir: string = defaultConfigDir()
): Promise<CredentialStore> => {
  try {
    const raw = await readFile(join(dir, FILE_NAME), 'utf8');
    const parsed = JSON.parse(raw) as Partial<CredentialStore>;
    return {
      version: 1,
      defaultOrgId: parsed.defaultOrgId ?? null,
      orgs: parsed.orgs ?? {},
    };
  } catch {
    // Absent or unreadable both mean "not logged in", which the caller already
    // has to handle. A parse error here should not be fatal to `ot login`.
    return empty();
  }
};

const writeStore = async (
  dir: string,
  store: CredentialStore
): Promise<void> => {
  await mkdir(dir, { recursive: true });
  const path = join(dir, FILE_NAME);
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  // `mode` on writeFile only applies at CREATE, so an existing file keeps
  // whatever it had. Set it every time.
  await chmod(path, 0o600).catch(() => {
    /* Windows has no POSIX bits; nothing to enforce there. */
  });
};

export const saveCredential = async (
  dir: string,
  orgId: string,
  credential: StoredCredential
): Promise<CredentialStore> => {
  const store = await loadCredentials(dir);

  store.orgs[orgId] = credential;
  // First login wins the default; `ot switch` is what changes it afterwards.
  store.defaultOrgId ??= orgId;

  await writeStore(dir, store);

  return store;
};

/**
 * Point the default at an org that already has a key.
 *
 * Separate from `saveCredential`, which guards the default with `??=` so a
 * second login cannot silently steal it — and therefore can never CHANGE it.
 * Switching has to say so explicitly, or it reports success and writes nothing.
 */
export const setDefaultOrg = async (
  dir: string,
  orgId: string
): Promise<CredentialStore> => {
  const store = await loadCredentials(dir);

  if (!store.orgs[orgId]) {
    throw new MissingCredentialError(
      `No credential stored for organization ${orgId}. Run \`ot login --org ${orgId}\`.`
    );
  }

  store.defaultOrgId = orgId;
  await writeStore(dir, store);

  return store;
};

export const resolveCredential = (
  store: CredentialStore,
  options: ResolveOptions
): StoredCredential => {
  if (options.orgId) {
    const found = store.orgs[options.orgId];
    if (!found) {
      // Fail closed. Falling back to another org's key would run the command
      // against an organization the user did not choose.
      throw new MissingCredentialError(
        `No credential stored for organization ${options.orgId}. Run \`ot login --org ${options.orgId}\`.`
      );
    }
    return found;
  }

  const ids = Object.keys(store.orgs);
  if (ids.length === 0) {
    throw new MissingCredentialError('Not logged in. Run `ot login`.');
  }

  if (ids.length === 1) return store.orgs[ids[0]!]!;

  const fallback = store.defaultOrgId
    ? store.orgs[store.defaultOrgId]
    : undefined;
  if (!fallback) {
    throw new MissingCredentialError(
      'Several organizations are logged in and no default is set. Run `ot switch` or pass --org.'
    );
  }

  return fallback;
};
