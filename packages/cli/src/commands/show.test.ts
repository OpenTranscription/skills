import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveCredential } from '../credentials.js';

import { parseTimecode, show } from './show.js';

let dir: string;
let lines: string[];
const log = (line: string) => lines.push(line);

const segments = [
  { start: 0, end: 30, text: 'Opening remarks.', speaker: 'A' },
  { start: 30, end: 90, text: 'The budget section.', speaker: 'B' },
  { start: 90, end: 150, text: 'Closing.', speaker: 'A' },
];

const client = (over: Record<string, unknown> = {}) => ({
  getJob: vi.fn(async () => ({
    id: 'job-1',
    status: 'completed',
    transcript: { text: 'all of it', segments },
    ...over,
  })),
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ot-show-'));
  await saveCredential(dir, 'org-a', {
    apiKey: 'ot_k',
    organizationName: 'Acme',
    scopes: ['transcriptions:read'],
  });
  lines = [];
});

describe('parseTimecode', () => {
  it.each([
    ['90', 90],
    ['1:30', 90],
    ['1:02:03', 3723],
  ])('reads %s as %d seconds', (input, expected) => {
    expect(parseTimecode(input)).toBe(expected);
  });

  it('rejects something that is not a timecode', () => {
    expect(() => parseTimecode('half past')).toThrow(/timecode/);
  });
});

describe('ot show', () => {
  it('prints the whole transcript when no range is given', async () => {
    await show({
      jobId: 'job-1',
      configDir: dir,
      log,
      client: client() as never,
    });

    const output = lines.join('\n');
    expect(output).toContain('Opening remarks.');
    expect(output).toContain('Closing.');
  });

  it('slices to the requested range', async () => {
    await show({
      jobId: 'job-1',
      from: '0:30',
      to: '1:30',
      configDir: dir,
      log,
      client: client() as never,
    });

    const output = lines.join('\n');
    expect(output).toContain('The budget section.');
    expect(output).not.toContain('Opening remarks.');
    expect(output).not.toContain('Closing.');
  });

  /**
   * A segment straddling the boundary is what the caller pointed at. Requiring
   * full containment silently drops the sentence they asked to read.
   */
  it('keeps a segment that overlaps the boundary', async () => {
    await show({
      jobId: 'job-1',
      from: '0:29',
      to: '0:31',
      configDir: dir,
      log,
      client: client() as never,
    });

    const output = lines.join('\n');
    expect(output).toContain('Opening remarks.');
    expect(output).toContain('The budget section.');
  });

  it('says so rather than printing nothing for an empty range', async () => {
    const code = await show({
      jobId: 'job-1',
      from: '10:00',
      configDir: dir,
      log,
      client: client() as never,
    });

    expect(code).toBe(1);
    expect(lines.join('\n')).toBe('Nothing in that range.');
  });

  it('reports a job that has no transcript yet', async () => {
    const code = await show({
      jobId: 'job-1',
      configDir: dir,
      log,
      client: client({ status: 'processing', transcript: undefined }) as never,
    });

    expect(code).toBe(1);
    expect(lines.join('\n')).toMatch(/no transcript.*processing/);
  });
});
