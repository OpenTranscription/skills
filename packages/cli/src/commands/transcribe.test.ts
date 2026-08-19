import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveCredential } from '../credentials.js';
import { transcribe } from './transcribe.js';

let dir: string;
let audio: string;
let lines: string[];
const log = (line: string) => lines.push(line);

const segments = [
  { start: 0, end: 4, text: 'Welcome to the show.', speaker: 'A' },
  { start: 4, end: 9, text: 'Glad to be here.', speaker: 'B' },
];

const fakeClient = (over: Record<string, unknown> = {}) => ({
  transcribe: vi.fn(async () => ({ id: 'job-1', status: 'queued' })),
  waitForJob: vi.fn(async () => ({
    id: 'job-1',
    status: 'completed',
    model_id: 'openai/whisper-large-v3',
    duration_seconds: 9,
    transcript: { text: 'Welcome to the show. Glad to be here.', segments },
    ...over,
  })),
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ot-tr-'));
  audio = join(dir, 'interview.mp3');
  await writeFile(audio, Buffer.from([1, 2, 3]));
  await saveCredential(dir, 'org-a', {
    apiKey: 'ot_k',
    organizationName: 'Acme',
    scopes: ['transcriptions:read', 'transcriptions:write'],
  });
  lines = [];
});

describe('ot transcribe', () => {
  it('writes every artifact next to the audio', async () => {
    const code = await transcribe({
      file: audio,
      configDir: dir,
      log,
      client: fakeClient() as never,
    });

    expect(code).toBe(0);
    await expect(
      readFile(join(dir, 'interview.transcript.md'), 'utf8')
    ).resolves.toContain('Welcome to the show.');
    await expect(
      readFile(join(dir, 'interview.srt'), 'utf8')
    ).resolves.toContain('00:00:00,000 --> 00:00:04,000');
    await expect(
      readFile(join(dir, 'interview.vtt'), 'utf8')
    ).resolves.toContain('WEBVTT');
    await expect(
      readFile(join(dir, 'interview.json'), 'utf8')
    ).resolves.toContain('job-1');
  });

  it('labels speakers in the markdown when the model diarized', async () => {
    await transcribe({
      file: audio,
      configDir: dir,
      log,
      client: fakeClient() as never,
    });

    const md = await readFile(join(dir, 'interview.transcript.md'), 'utf8');
    expect(md).toContain('**A**');
    expect(md).toContain('**B**');
  });

  it('writes plain prose when the model did not diarize', async () => {
    const plain = [{ start: 0, end: 4, text: 'Just one voice.' }];
    await transcribe({
      file: audio,
      configDir: dir,
      log,
      client: fakeClient({
        transcript: { text: 'Just one voice.', segments: plain },
      }) as never,
    });

    const md = await readFile(join(dir, 'interview.transcript.md'), 'utf8');
    expect(md).not.toContain('**');
  });

  /**
   * The point of the whole output contract: a short transcript is cheap to hand
   * back, a long one is not, and the caller should never have to ask.
   */
  it('returns the transcript inline when it is short', async () => {
    await transcribe({
      file: audio,
      configDir: dir,
      log,
      client: fakeClient() as never,
    });

    expect(lines.join('\n')).toContain('Welcome to the show.');
  });

  it('returns a receipt with paths instead of a long transcript', async () => {
    const long = 'word '.repeat(20_000);
    await transcribe({
      file: audio,
      configDir: dir,
      log,
      client: fakeClient({
        transcript: {
          text: long,
          segments: [{ start: 0, end: 3600, text: long, speaker: 'A' }],
        },
      }) as never,
    });

    const output = lines.join('\n');
    expect(output).not.toContain(long);
    expect(output).toContain('interview.transcript.md');
  });

  it('refuses before uploading when the named org has no key', async () => {
    await expect(
      transcribe({
        file: audio,
        orgId: 'org-other',
        configDir: dir,
        log,
        client: fakeClient() as never,
      })
    ).rejects.toThrow(/ot login --org org-other/);
  });

  it('passes the chosen model through to the API', async () => {
    const client = fakeClient();
    await transcribe({
      file: audio,
      model: 'auto/best',
      configDir: dir,
      log,
      client: client as never,
    });

    expect(client.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'auto/best', fileName: 'interview.mp3' })
    );
  });
});
