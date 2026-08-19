import { describe, expect, it, vi } from 'vitest';

import { DeviceFlowError, runDeviceFlow } from './deviceFlow.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const CODE_RESPONSE = {
  device_code: 'dev-abc',
  user_code: 'WDJB-MJHT',
  verification_uri: 'https://opentranscription.io/device',
  verification_uri_complete:
    'https://opentranscription.io/device?user_code=WDJB-MJHT',
  expires_in: 900,
  interval: 5,
};

/**
 * Drives the flow with a scripted sequence of token responses and records every
 * sleep, because the WAIT SCHEDULE is the part of RFC 8628 that is easy to get
 * subtly wrong and impossible to see from a passing happy path.
 */
const harness = (tokenResponses: Array<() => Response>) => {
  const sleeps: number[] = [];
  let n = 0;

  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.endsWith('/api/v1/device/code')) return json(CODE_RESPONSE);
    if (url.endsWith('/api/v1/device/token')) return tokenResponses[n++]!();
    throw new Error(`unstubbed ${url}`);
  }) as unknown as typeof fetch;

  return {
    sleeps,
    run: (onPrompt = vi.fn()) =>
      runDeviceFlow(
        { baseUrl: 'https://api.test', clientName: 'ot-cli' },
        {
          fetch: fetchImpl,
          sleep: async (ms: number) => {
            sleeps.push(ms);
          },
          onPrompt,
        }
      ),
  };
};

const pending = () => json({ error: 'authorization_pending' }, 400);
const slowDown = () => json({ error: 'slow_down' }, 400);
const granted = () =>
  json({
    api_key: 'ot_live_key',
    organization_id: 'org-1',
    organization_name: 'Acme',
    scopes: ['transcriptions:read', 'transcriptions:write'],
  });

describe('runDeviceFlow', () => {
  it('shows the user the code and the link before it starts waiting', async () => {
    const onPrompt = vi.fn();
    await harness([granted()].map((r) => () => r)).run(onPrompt);

    expect(onPrompt).toHaveBeenCalledWith({
      userCode: 'WDJB-MJHT',
      verificationUri: 'https://opentranscription.io/device',
      verificationUriComplete:
        'https://opentranscription.io/device?user_code=WDJB-MJHT',
      expiresInSeconds: 900,
    });
  });

  it('returns the credential once the user approves', async () => {
    const h = harness([pending, granted]);
    const result = await h.run();

    expect(result).toEqual({
      apiKey: 'ot_live_key',
      organizationId: 'org-1',
      organizationName: 'Acme',
      scopes: ['transcriptions:read', 'transcriptions:write'],
    });
  });

  it('waits the server-supplied interval between polls', async () => {
    const h = harness([pending, pending, granted]);
    await h.run();

    expect(h.sleeps).toEqual([5000, 5000]);
  });

  /**
   * RFC 8628 §3.5: `slow_down` adds 5s to the interval, and the increase is
   * CUMULATIVE — a client that resets to the base interval after the next
   * success keeps tripping the same limit forever.
   */
  it('adds 5s cumulatively for each slow_down, and never goes back down', async () => {
    const h = harness([slowDown, slowDown, pending, granted]);
    await h.run();

    expect(h.sleeps).toEqual([10_000, 15_000, 15_000]);
  });

  it('gives up with access_denied when the user declines', async () => {
    const h = harness([() => json({ error: 'access_denied' }, 400)]);

    await expect(h.run()).rejects.toBeInstanceOf(DeviceFlowError);
    await expect(
      harness([() => json({ error: 'access_denied' }, 400)]).run()
    ).rejects.toMatchObject({ code: 'access_denied' });
  });

  it('gives up when the grant expires', async () => {
    const h = harness([() => json({ error: 'expired_token' }, 400)]);

    await expect(h.run()).rejects.toMatchObject({ code: 'expired_token' });
  });

  /**
   * Anything outside the pending/slow_down pair is terminal per the RFC. Treating
   * an unknown error as "keep waiting" is how a client polls a dead grant until
   * its deadline.
   */
  it('stops on an error it does not recognise rather than polling on', async () => {
    const h = harness([() => json({ error: 'invalid_grant' }, 400)]);

    await expect(h.run()).rejects.toMatchObject({ code: 'invalid_grant' });
  });
});
