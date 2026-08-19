import { openBrowser } from '../browser.js';
import {
  defaultConfigDir,
  loadCredentials,
  saveCredential,
} from '../credentials.js';
import { runDeviceFlow } from '../deviceFlow.js';
import { apiBaseUrl } from '../env.js';

export type LoginOptions = {
  orgId?: string | undefined;
  configDir?: string;
  /** Injected in tests; defaults to the real waiting kind. */
  sleep?: (ms: number) => Promise<void>;
  fetch?: typeof fetch;
  log?: (line: string) => void;
};

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `ot login` — RFC 8628 device flow, then store the key under its org.
 *
 * The key that comes back is bound to one organization, so it is stored under
 * that org's id rather than replacing whatever was there. Logging into a second
 * org adds a second key; it does not sign you out of the first.
 */
export const login = async (options: LoginOptions = {}): Promise<number> => {
  const log = options.log ?? ((line: string) => console.log(line));
  const dir = options.configDir ?? defaultConfigDir();

  const credential = await runDeviceFlow(
    {
      baseUrl: apiBaseUrl(),
      clientName: 'ot-cli',
      ...(options.orgId ? { orgId: options.orgId } : {}),
    },
    {
      fetch: options.fetch ?? globalThis.fetch,
      sleep: options.sleep ?? realSleep,
      onPrompt: (prompt) => {
        log('');
        log(`  Your code:  ${prompt.userCode}`);
        log(`  Open:       ${prompt.verificationUriComplete}`);
        log('');
        log(
          `  Waiting for approval — the code expires in ${Math.round(
            prompt.expiresInSeconds / 60
          )} minutes.`
        );
        openBrowser(prompt.verificationUriComplete);
      },
    }
  );

  await saveCredential(dir, credential.organizationId, {
    apiKey: credential.apiKey,
    organizationName: credential.organizationName,
    scopes: credential.scopes,
  });

  const store = await loadCredentials(dir);
  const name = credential.organizationName ?? credential.organizationId;
  const count = Object.keys(store.orgs).length;

  log('');
  log(`✓ Signed in to ${name}.`);
  if (count > 1) {
    log(`  ${count} workspaces available — use --org or \`ot switch\`.`);
  }

  return 0;
};
