import { describe, expect, it } from 'vitest';

import { OpenTranscription } from './client.js';

type Call = { url: string; init: RequestInit | undefined };

/**
 * A fetch double that answers by URL. Every test asserts on `calls`, because the
 * ORDER and the SHAPE of the three-step upload is the contract — a client that
 * gets the steps right but attaches the wrong credential to the storage PUT is
 * broken in a way a status-code assertion would not catch.
 */
const stubFetch = (
  routes: Record<string, () => Response>
): { fetch: typeof fetch; calls: Call[] } => {
  const calls: Call[] = [];
  const fetchImpl = (async (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit
  ) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    const key = Object.keys(routes).find((r) => url.includes(r));
    if (!key) throw new Error(`unstubbed request: ${url}`);
    return routes[key]!();
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const client = (fetchImpl: typeof fetch) =>
  new OpenTranscription({
    apiKey: 'ot_test',
    baseUrl: 'https://api.test',
    fetch: fetchImpl,
  });

describe('transcribe', () => {
  it('runs the three-step upload in order', async () => {
    const { fetch, calls } = stubFetch({
      '/api/v1/uploads': () =>
        json({
          upload_url: 'https://storage.test/put/abc',
          file_path: 'org/abc.mp3',
        }),
      'storage.test': () => new Response(null, { status: 200 }),
      '/api/v1/transcriptions': () => json({ id: 'job-1', status: 'queued' }),
    });

    const job = await client(fetch).transcribe({
      file: new Uint8Array([1, 2, 3]),
      fileName: 'interview.mp3',
    });

    expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
      '/api/v1/uploads',
      '/put/abc',
      '/api/v1/transcriptions',
    ]);
    expect(job.id).toBe('job-1');
  });

  it('sends the file_path the API handed back, not a path it invented', async () => {
    const { fetch, calls } = stubFetch({
      '/api/v1/uploads': () =>
        json({
          upload_url: 'https://storage.test/put/abc',
          file_path: 'org-9/xyz.mp3',
        }),
      'storage.test': () => new Response(null, { status: 200 }),
      '/api/v1/transcriptions': () => json({ id: 'job-1', status: 'queued' }),
    });

    await client(fetch).transcribe({
      file: new Uint8Array([1]),
      fileName: 'a.mp3',
      model: 'auto/best',
    });

    const body = JSON.parse(calls[2]!.init!.body as string);
    expect(body.file_path).toBe('org-9/xyz.mp3');
    expect(body.model).toBe('auto/best');
  });

  /**
   * The upload route requires file_name, file_size and mime_type, and answers a
   * bare "Validation error" when any is missing or renamed. Nothing in a mocked
   * happy path notices that, so the field names are pinned here.
   */
  it('sends exactly the fields the upload route requires', async () => {
    const { fetch, calls } = stubFetch({
      '/api/v1/uploads': () =>
        json({
          upload_url: 'https://storage.test/put/abc',
          file_path: 'p.mp3',
        }),
      'storage.test': () => new Response(null, { status: 200 }),
      '/api/v1/transcriptions': () => json({ id: 'j', status: 'queued' }),
    });

    await client(fetch).transcribe({
      file: new Uint8Array([1, 2, 3, 4, 5]),
      fileName: 'a.mp3',
    });

    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({
      file_name: 'a.mp3',
      file_size: 5,
      mime_type: 'audio/mpeg',
    });
  });

  /**
   * The upload URL is already signed. Attaching the API key to it would send a
   * live credential to a host that never needs it, and storage would reject or
   * ignore it either way.
   */
  it('never sends the API key to the storage host', async () => {
    const { fetch, calls } = stubFetch({
      '/api/v1/uploads': () =>
        json({
          upload_url: 'https://storage.test/put/abc',
          file_path: 'p.mp3',
        }),
      'storage.test': () => new Response(null, { status: 200 }),
      '/api/v1/transcriptions': () => json({ id: 'j', status: 'queued' }),
    });

    await client(fetch).transcribe({
      file: new Uint8Array([1]),
      fileName: 'a.mp3',
    });

    const storagePut = calls[1]!;
    const headers = new Headers(storagePut.init?.headers);
    expect(headers.get('authorization')).toBeNull();

    const apiCall = calls[0]!;
    expect(new Headers(apiCall.init?.headers).get('authorization')).toBe(
      'Bearer ot_test'
    );
  });

  it('surfaces the API error rather than a generic failure', async () => {
    const { fetch } = stubFetch({
      '/api/v1/uploads': () =>
        json(
          { error: 'Free minutes exhausted.', code: 'FREE_MINUTES_EXHAUSTED' },
          402
        ),
    });

    await expect(
      client(fetch).transcribe({ file: new Uint8Array([1]), fileName: 'a.mp3' })
    ).rejects.toMatchObject({ status: 402, code: 'FREE_MINUTES_EXHAUSTED' });
  });
});

describe('rate limiting', () => {
  /**
   * The free tier allows 10 requests a minute, which one `ot transcribe` can
   * reach on its own: uploads, transcriptions, then a poll every couple of
   * seconds. Surfacing that to the agent as a failure would be blaming the user
   * for the client's own pacing.
   */
  it('waits and retries instead of failing on a 429', async () => {
    const sleeps: number[] = [];
    let attempt = 0;
    const { fetch } = stubFetch({
      '/api/v1/transcriptions/job-1': () => {
        attempt += 1;
        return attempt === 1
          ? new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
              status: 429,
              headers: { 'retry-after': '2' },
            })
          : json({ id: 'job-1', status: 'completed' });
      },
    });

    const ot = new OpenTranscription({
      apiKey: 'ot_test',
      baseUrl: 'https://api.test',
      fetch,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    });

    await expect(ot.getJob('job-1')).resolves.toMatchObject({
      status: 'completed',
    });
    expect(sleeps).toEqual([2000]);
  });

  it('gives up rather than retrying forever', async () => {
    const { fetch } = stubFetch({
      '/api/v1/transcriptions/job-1': () =>
        new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { 'retry-after': '1' },
        }),
    });

    const ot = new OpenTranscription({
      apiKey: 'ot_test',
      baseUrl: 'https://api.test',
      fetch,
      sleep: async () => {},
    });

    await expect(ot.getJob('job-1')).rejects.toMatchObject({ status: 429 });
  });
});

describe('waitForJob', () => {
  it('polls until the job reaches a terminal status', async () => {
    let n = 0;
    const { fetch, calls } = stubFetch({
      '/api/v1/transcriptions/job-1': () => {
        n += 1;
        return json({
          id: 'job-1',
          status: n < 3 ? 'processing' : 'completed',
        });
      },
    });

    const job = await client(fetch).waitForJob('job-1', { pollIntervalMs: 0 });

    expect(job.status).toBe('completed');
    expect(calls).toHaveLength(3);
  });

  /**
   * `error_code` only became available on the read routes in a1b571be. Before
   * that a client had to parse prose, which is exactly what this surfaces so the
   * CLI never has to.
   */
  it('rejects a failed job with its machine-readable code', async () => {
    const { fetch } = stubFetch({
      '/api/v1/transcriptions/job-1': () =>
        json({
          id: 'job-1',
          status: 'failed',
          error: 'The audio file could not be decoded.',
          error_code: 'AUDIO_DECODE_FAILED',
        }),
    });

    await expect(
      client(fetch).waitForJob('job-1', { pollIntervalMs: 0 })
    ).rejects.toMatchObject({
      code: 'AUDIO_DECODE_FAILED',
      message: 'The audio file could not be decoded.',
    });
  });

  it('stops when the caller aborts', async () => {
    const controller = new AbortController();
    const { fetch } = stubFetch({
      '/api/v1/transcriptions/job-1': () => {
        controller.abort();
        return json({ id: 'job-1', status: 'processing' });
      },
    });

    await expect(
      client(fetch).waitForJob('job-1', {
        pollIntervalMs: 0,
        signal: controller.signal,
      })
    ).rejects.toThrow(/abort/i);
  });
});
