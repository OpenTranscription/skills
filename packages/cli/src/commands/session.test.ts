import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { loadCredentials, saveCredential } from '../credentials.js';
import { switchOrg, whoami } from './session.js';

let dir: string;
let lines: string[];
const log = (line: string) => lines.push(line);

const cred = (apiKey: string, name: string) => ({
  apiKey,
  organizationName: name,
  scopes: ['transcriptions:read'],
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ot-session-'));
  lines = [];
});

describe('whoami', () => {
  it('exits non-zero and says how to fix it when nothing is stored', async () => {
    const code = await whoami({ configDir: dir, log });

    expect(code).toBe(1);
    expect(lines.join('\n')).toMatch(/ot login/);
  });

  it('marks which workspace commands will use', async () => {
    await saveCredential(dir, 'org-a', cred('k1', 'Acme'));
    await saveCredential(dir, 'org-b', cred('k2', 'Beta'));

    await whoami({ configDir: dir, log });

    expect(lines.find((l) => l.startsWith('*'))).toContain('Acme');
    expect(lines.find((l) => l.startsWith(' '))).toContain('Beta');
  });
});

describe('switchOrg', () => {
  /**
   * The first login wins the default, and `saveCredential` protects it with
   * `??=` so a later login cannot silently steal it. That means switching needs
   * to write the default explicitly — a switch that only mutates an in-memory
   * copy reports success and changes nothing.
   */
  it('actually persists the new default', async () => {
    await saveCredential(dir, 'org-a', cred('k1', 'Acme'));
    await saveCredential(dir, 'org-b', cred('k2', 'Beta'));

    const code = await switchOrg('org-b', { configDir: dir, log });

    expect(code).toBe(0);
    expect((await loadCredentials(dir)).defaultOrgId).toBe('org-b');
  });

  it('leaves the stored key untouched when it switches', async () => {
    await saveCredential(dir, 'org-a', cred('k1', 'Acme'));
    await saveCredential(dir, 'org-b', cred('k2', 'Beta'));

    await switchOrg('org-b', { configDir: dir, log });

    expect((await loadCredentials(dir)).orgs['org-b']!.apiKey).toBe('k2');
  });

  it('refuses to switch to an org with no stored key', async () => {
    await saveCredential(dir, 'org-a', cred('k1', 'Acme'));

    const code = await switchOrg('org-zzz', { configDir: dir, log });

    expect(code).toBe(1);
    expect(lines.join('\n')).toMatch(/ot login --org org-zzz/);
    expect((await loadCredentials(dir)).defaultOrgId).toBe('org-a');
  });
});
