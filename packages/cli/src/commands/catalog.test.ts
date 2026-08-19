import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveCredential } from '../credentials.js';

import { jobs, models } from './catalog.js';

let dir: string;
let lines: string[];
const log = (line: string) => lines.push(line);

// Shaped like the real payload: pricing and languages are nested, and the
// models sit one level deeper than the other list routes put theirs.
const catalog = [
  {
    id: 'openai/whisper-large-v3',
    display_name: 'Whisper Large v3',
    pricing: { cost_per_second: 0.01, currency: 'credits' },
    performance: { avg_wer: 0.1 },
    capabilities: { supported_languages: ['en', 'es'] },
  },
  {
    id: 'deepgram/nova-3',
    display_name: 'Nova 3',
    pricing: { cost_per_second: 0.007, currency: 'credits' },
    performance: { avg_wer: null },
    capabilities: { supported_languages: ['en'] },
  },
];

const client = (over: Record<string, unknown> = {}) => ({
  listModels: vi.fn(async () => catalog),
  listJobs: vi.fn(async () => [
    { id: 'job-1', status: 'completed', file_name: 'a.mp3' },
    {
      id: 'job-2',
      status: 'failed',
      file_name: 'b.mp3',
      error_code: 'AUDIO_DECODE_FAILED',
    },
  ]),
  ...over,
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ot-cat-'));
  await saveCredential(dir, 'org-a', {
    apiKey: 'ot_k',
    organizationName: 'Acme',
    scopes: ['transcriptions:read'],
  });
  lines = [];
});

describe('ot models', () => {
  it('lists the auto strategies first, since they are the safe default', async () => {
    await models({ configDir: dir, log, client: client() as never });

    expect(lines[0]).toContain('auto/best');
    expect(lines[1]).toContain('auto/cheapest');
  });

  /**
   * `/v1/models` is a public catalogue route. Requiring a login to read it would
   * be friction the API does not impose, and it blocks the useful case where an
   * agent checks what is available before anyone has signed in.
   */
  it('works with no credentials stored at all', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'ot-anon-'));
    // Deliberately NOT injecting a client: that would short-circuit the very
    // credential lookup this is about, and the test would pass either way.
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: { models: catalog } }), {
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;

    const code = await models({ configDir: empty, log, fetch: fetchImpl });

    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('openai/whisper-large-v3');
  });

  it('still requires a key for jobs, which is not a public route', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'ot-anon2-'));

    await expect(jobs({ configDir: empty, log })).rejects.toThrow(/ot login/);
  });

  it('shows a per-minute price, which is the unit people compare', async () => {
    await models({ configDir: dir, log, client: client() as never });

    // 0.01 credits/second is 0.60 per minute. Per-second pricing is four
    // leading zeros on real models and nobody compares it correctly.
    expect(lines.join('\n')).toContain('0.60 cr/min');
  });

  it('filters to models that support a requested language', async () => {
    await models({
      configDir: dir,
      log,
      language: 'es',
      client: client() as never,
    });

    const output = lines.join('\n');
    expect(output).toContain('openai/whisper-large-v3');
    expect(output).not.toContain('deepgram/nova-3');
  });

  it('exits non-zero when nothing supports the language', async () => {
    const code = await models({
      configDir: dir,
      log,
      language: 'xx',
      client: client() as never,
    });

    expect(code).toBe(1);
    expect(lines.join('\n')).toMatch(/No models support/);
  });
});

describe('ot jobs', () => {
  it('shows the failure code next to a failed job', async () => {
    await jobs({ configDir: dir, log, client: client() as never });

    expect(lines.find((l) => l.includes('job-2'))).toContain(
      'AUDIO_DECODE_FAILED'
    );
  });

  it('says so plainly when there is nothing yet', async () => {
    const code = await jobs({
      configDir: dir,
      log,
      client: client({ listJobs: vi.fn(async () => []) }) as never,
    });

    expect(code).toBe(0);
    expect(lines.join('\n')).toBe('No transcriptions yet.');
  });
});
