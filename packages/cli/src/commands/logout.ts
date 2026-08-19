import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

import {
  defaultConfigDir,
  loadCredentials,
  saveCredential,
} from '../credentials.js';

export type LogoutOptions = {
  orgId?: string | undefined;
  all?: boolean;
  configDir?: string;
  log?: (line: string) => void;
};

/**
 * `ot logout` — forget one workspace, or all of them.
 *
 * Local only. The key stays valid server-side until it is revoked in the web
 * app, and saying otherwise would be a lie a user might rely on.
 */
export const logout = async (options: LogoutOptions = {}): Promise<number> => {
  const log = options.log ?? ((line: string) => console.log(line));
  const dir = options.configDir ?? defaultConfigDir();
  const store = await loadCredentials(dir);
  const ids = Object.keys(store.orgs);

  if (ids.length === 0) {
    log('Not signed in.');
    return 0;
  }

  if (options.all || (!options.orgId && ids.length === 1)) {
    await unlink(join(dir, 'credentials.json')).catch(() => {
      /* Already gone is the desired end state. */
    });
    log('✓ Signed out. Revoke the keys at opentranscription.io/settings/keys.');
    return 0;
  }

  if (!options.orgId) {
    log('Several workspaces are signed in. Pass --org <id>, or --all.');
    return 2;
  }

  if (!store.orgs[options.orgId]) {
    log(`Not signed in to ${options.orgId}.`);
    return 1;
  }

  delete store.orgs[options.orgId];
  if (store.defaultOrgId === options.orgId) store.defaultOrgId = null;

  // Rewrite from a surviving entry so the 0600 write path is the only writer.
  const remaining = Object.entries(store.orgs);
  await unlink(join(dir, 'credentials.json')).catch(() => {});
  for (const [id, credential] of remaining) {
    await saveCredential(dir, id, credential);
  }

  log(`✓ Signed out of ${options.orgId}.`);
  return 0;
};
