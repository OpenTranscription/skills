import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveCredential } from '../credentials.js';

import { jobs, models } from './catalog.js';

let dir: string;
let lines: string[];
const log = (line: string) => lines.push(line);

const catalog = [
  {
    id: 'openai/whisper-large-v3',
    display_name: 'Whisper Large v3',
    cost_per_second: 0.0001,
    languages: ['en', 'es'],
  },
  {
    id: 'deepgram/nova-3',
    display_name: 'Nova 3',
    cost_per_second: 0.00007,
    languages: ['en'],
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

  it('shows a per-minute price, which is the unit people compare', async () => {
    await models({ configDir: dir, log, client: client() as never });

    // 0.0001/second is $0.0060/min — the per-second figure is unreadable.
    expect(lines.join('\n')).toContain('$0.0060/min');
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
