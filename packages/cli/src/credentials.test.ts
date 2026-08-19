import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  loadCredentials,
  MissingCredentialError,
  resolveCredential,
  saveCredential,
} from './credentials.js';

let dir: string;

const cred = (
  over: Partial<{ apiKey: string; organizationName: string }> = {}
) => ({
  apiKey: 'ot_key_a',
  organizationName: 'Acme',
  scopes: ['transcriptions:read', 'transcriptions:write'],
  ...over,
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ot-cli-'));
});

describe('credential store', () => {
  it('keeps one key per org rather than one key', async () => {
    await saveCredential(dir, 'org-a', cred());
    await saveCredential(
      dir,
      'org-b',
      cred({ apiKey: 'ot_key_b', organizationName: 'Beta' })
    );

    const store = await loadCredentials(dir);

    expect(Object.keys(store.orgs).sort()).toEqual(['org-a', 'org-b']);
    expect(store.orgs['org-a']!.apiKey).toBe('ot_key_a');
    expect(store.orgs['org-b']!.apiKey).toBe('ot_key_b');
  });

  it('makes the first org logged into the default', async () => {
    await saveCredential(dir, 'org-a', cred());
    await saveCredential(dir, 'org-b', cred({ apiKey: 'ot_key_b' }));

    expect((await loadCredentials(dir)).defaultOrgId).toBe('org-a');
  });

  /**
   * The file holds live API keys. World-readable would be the kind of thing
   * nobody notices until it is in someone's dotfiles repo.
   */
  it('writes the file so only the owner can read it', async () => {
    await saveCredential(dir, 'org-a', cred());

    const info = await stat(join(dir, 'credentials.json'));
    // Windows does not model POSIX bits; assert where it means something.
    if (process.platform !== 'win32') {
      expect(info.mode & 0o777).toBe(0o600);
    }
    expect(
      JSON.parse(await readFile(join(dir, 'credentials.json'), 'utf8')).version
    ).toBe(1);
  });

  it('returns an empty store rather than throwing when nothing is saved yet', async () => {
    const store = await loadCredentials(dir);

    expect(store.orgs).toEqual({});
    expect(store.defaultOrgId).toBeNull();
  });
});

describe('resolveCredential', () => {
  it('uses the named org when one is asked for', async () => {
    await saveCredential(dir, 'org-a', cred());
    await saveCredential(dir, 'org-b', cred({ apiKey: 'ot_key_b' }));

    const store = await loadCredentials(dir);

    expect(resolveCredential(store, { orgId: 'org-b' }).apiKey).toBe(
      'ot_key_b'
    );
  });

  /**
   * The whole reason the store is a map. `api_keys.organization_id` is fixed when
   * the key is minted, so a key for another org would authenticate happily and
   * act on the WRONG org — silently, and with a valid credential. Refusing is the
   * only safe answer.
   */
  it('refuses rather than falling back when the named org has no key', async () => {
    await saveCredential(dir, 'org-a', cred());
    const store = await loadCredentials(dir);

    expect(() => resolveCredential(store, { orgId: 'org-zzz' })).toThrow(
      MissingCredentialError
    );
    expect(() => resolveCredential(store, { orgId: 'org-zzz' })).toThrow(
      /ot login --org org-zzz/
    );
  });

  it('uses the only org when there is exactly one and none was named', async () => {
    await saveCredential(dir, 'org-a', cred());
    const store = await loadCredentials(dir);

    expect(resolveCredential(store, {}).apiKey).toBe('ot_key_a');
  });

  it('uses the default when several orgs are stored and none was named', async () => {
    await saveCredential(dir, 'org-a', cred());
    await saveCredential(dir, 'org-b', cred({ apiKey: 'ot_key_b' }));
    const store = await loadCredentials(dir);

    expect(resolveCredential(store, {}).apiKey).toBe('ot_key_a');
  });

  it('tells the user to log in when nothing is stored at all', async () => {
    const store = await loadCredentials(dir);

    expect(() => resolveCredential(store, {})).toThrow(/ot login/);
  });
});
