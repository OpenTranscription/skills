/**
 * RFC 8628 device-authorization client — what `ot login` runs.
 *
 * The server owns the schedule: it hands back `interval` and `expires_in`, and
 * answers `slow_down` when we ask too often. All this does is obey, which is
 * most of what the RFC asks of a client.
 */

const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

/** RFC 8628 §3.5: each `slow_down` adds this to the interval, cumulatively. */
const SLOW_DOWN_INCREMENT_SECONDS = 5;

/** Used only when the server omits `interval`, per §3.5. */
const DEFAULT_INTERVAL_SECONDS = 5;

export type DevicePrompt = {
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresInSeconds: number;
};

export type DeviceCredential = {
  apiKey: string;
  organizationId: string;
  organizationName: string | null;
  scopes: string[];
};

export type DeviceFlowInput = {
  baseUrl: string;
  clientName: string;
  /** Unverified hint; the approval page re-checks membership before honouring it. */
  orgId?: string;
};

export type DeviceFlowDeps = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  onPrompt: (prompt: DevicePrompt) => void;
};

/** A terminal answer from the token endpoint. */
export class DeviceFlowError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'DeviceFlowError';
    this.code = code;
  }
}

const MESSAGES: Record<string, string> = {
  access_denied: 'Authorization was declined in the browser.',
  expired_token:
    'The code expired before it was approved. Run `ot login` again.',
  invalid_grant: 'That device code is no longer valid. Run `ot login` again.',
};

export const runDeviceFlow = async (
  input: DeviceFlowInput,
  deps: DeviceFlowDeps
): Promise<DeviceCredential> => {
  const codeResponse = await deps.fetch(`${input.baseUrl}/v1/device/code`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: input.clientName,
      ...(input.orgId ? { org_id: input.orgId } : {}),
    }),
  });

  if (!codeResponse.ok) {
    throw new DeviceFlowError(
      'device_code_failed',
      'Could not start the login. Check your connection and try again.'
    );
  }

  const grant = (await codeResponse.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval?: number;
  };

  deps.onPrompt({
    userCode: grant.user_code,
    verificationUri: grant.verification_uri,
    verificationUriComplete: grant.verification_uri_complete,
    expiresInSeconds: grant.expires_in,
  });

  // Held outside the loop: a slow_down raises the interval for THIS request and
  // every one after it. Resetting between polls would trip the same limit
  // forever, which is the failure mode §3.5 exists to prevent.
  let intervalSeconds = grant.interval ?? DEFAULT_INTERVAL_SECONDS;

  for (let poll = 0; ; poll += 1) {
    // Wait BETWEEN polls, not before the first one: RFC 8628 §3.5 bounds the gap
    // between requests, and a leading sleep would add `interval` to every login
    // including one the user approves instantly.
    if (poll > 0) await deps.sleep(intervalSeconds * 1000);

    const response = await deps.fetch(`${input.baseUrl}/v1/device/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        device_code: grant.device_code,
        grant_type: GRANT_TYPE,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (response.ok) {
      return {
        apiKey: String(body.api_key),
        organizationId: String(body.organization_id),
        organizationName:
          typeof body.organization_name === 'string'
            ? body.organization_name
            : null,
        scopes: Array.isArray(body.scopes) ? (body.scopes as string[]) : [],
      };
    }

    const code = typeof body.error === 'string' ? body.error : 'invalid_grant';

    if (code === 'slow_down') {
      intervalSeconds += SLOW_DOWN_INCREMENT_SECONDS;
      continue;
    }

    if (code === 'authorization_pending') continue;

    // Everything else is terminal. Treating an unrecognised error as "keep
    // waiting" is how a client polls a dead grant until its deadline.
    throw new DeviceFlowError(code, MESSAGES[code]);
  }
};
