import {
  type CredentialStore,
  defaultConfigDir,
  loadCredentials,
  setDefaultOrg,
} from '../credentials.js';

type Io = { log?: (line: string) => void; configDir?: string };

const orgLabel = (store: CredentialStore, id: string): string =>
  store.orgs[id]?.organizationName ?? id;

/** `ot whoami` — which workspaces are signed in, and which one commands use. */
export const whoami = async (options: Io = {}): Promise<number> => {
  const log = options.log ?? ((line: string) => console.log(line));
  const store = await loadCredentials(options.configDir ?? defaultConfigDir());
  const ids = Object.keys(store.orgs);

  if (ids.length === 0) {
    log('Not signed in. Run `ot login`.');
    return 1;
  }

  for (const id of ids) {
    const marker = id === store.defaultOrgId ? '*' : ' ';
    log(`${marker} ${orgLabel(store, id)}  (${id})`);
  }
  if (ids.length > 1) log('\n* default — change it with `ot switch`.');

  return 0;
};

/** `ot switch <org>` — change which stored key commands use by default. */
export const switchOrg = async (
  orgId: string | undefined,
  options: Io = {}
): Promise<number> => {
  const log = options.log ?? ((line: string) => console.log(line));
  const dir = options.configDir ?? defaultConfigDir();
  const store = await loadCredentials(dir);

  if (!orgId) {
    log('Usage: ot switch <organization-id>');
    return 2;
  }

  if (!store.orgs[orgId]) {
    // Fail closed, exactly as resolveCredential does: switching to an org with
    // no key would leave every later command silently using another org's key.
    log(`No credential stored for ${orgId}. Run \`ot login --org ${orgId}\`.`);
    return 1;
  }

  await setDefaultOrg(dir, orgId);
  log(`✓ Default workspace is now ${orgLabel(store, orgId)}.`);

  return 0;
};
