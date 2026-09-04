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
    // The API routes all three (VIRTUAL_MODEL_MAP in the product repo). Leaving
    // one out of the only place an agent is told what it may pass makes that
    // strategy unreachable in practice.
    expect(lines[2]).toContain('auto/fastest');
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

  /**
   * A deprecated model is still servable when named, so it stays in the list —
   * the skill says "never pass a model you have not seen here", and hiding a
   * working id would turn that rule into a false rejection. It goes LAST so the
   * top of the list, where an agent picks from, is all active; and it names its
   * successor, since nothing else in the CLI does.
   */
  it('lists a deprecated model last, marked with its successor', async () => {
    const withDeprecated = [
      {
        id: 'deepgram/nova-2',
        display_name: 'Nova 2',
        lifecycle: 'deprecated',
        successor_model_id: 'deepgram/nova-3',
        pricing: { cost_per_second: 0.007, currency: 'credits' },
        performance: { avg_wer: 0.12 },
        capabilities: { supported_languages: ['en'] },
      },
      ...catalog.map((model) => ({
        ...model,
        lifecycle: 'active',
        successor_model_id: null,
      })),
    ];

    await models({
      configDir: dir,
      log,
      client: client({
        listModels: vi.fn(async () => withDeprecated),
      }) as never,
    });

    const rows = lines.filter((l) => l.includes('/') && !l.startsWith('auto/'));
    expect(rows.at(-1)).toContain('deepgram/nova-2');
    expect(rows.at(-1)).toContain('deprecated → deepgram/nova-3');
    expect(rows.find((l) => l.includes('deepgram/nova-3'))).not.toContain(
      'deprecated'
    );
  });

  it('marks a deprecated model with no recorded successor as just deprecated', async () => {
    await models({
      configDir: dir,
      log,
      client: client({
        listModels: vi.fn(async () => [
          {
            ...catalog[0],
            lifecycle: 'deprecated',
            successor_model_id: null,
          },
        ]),
      }) as never,
    });

    const row = lines.find((l) => l.includes('openai/whisper-large-v3'));
    expect(row).toContain('deprecated');
    expect(row).not.toContain('→');
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
