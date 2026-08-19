import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';

import { OpenTranscription } from '@opentranscription/sdk';

import {
  defaultConfigDir,
  loadCredentials,
  resolveCredential,
} from '../credentials.js';
import { apiBaseUrl } from '../env.js';
import { formatSrt, formatVtt, type Segment, summarize } from '../output.js';

export type TranscribeOptions = {
  file: string;
  orgId?: string | undefined;
  model?: string | undefined;
  language?: string | undefined;
  diarize?: boolean | undefined;
  outDir?: string | undefined;
  configDir?: string;
  log?: (line: string) => void;
  /** Injected by tests so the whole command can run without a network. */
  client?: Pick<OpenTranscription, 'transcribe' | 'waitForJob'>;
};

type TranscriptPayload = {
  text?: string;
  segments?: Segment[];
};

const markdown = (segments: Segment[], text: string): string => {
  const diarized = segments.some((segment) => segment.speaker !== undefined);
  if (!diarized) return `${text.trim()}\n`;

  const lines: string[] = [];
  let current: string | undefined;

  for (const segment of segments) {
    if (segment.speaker !== current) {
      if (current !== undefined) lines.push('');
      lines.push(`**${segment.speaker}**`);
      current = segment.speaker;
    }
    lines.push(segment.text.trim());
  }

  return `${lines.join('\n')}\n`;
};

/**
 * `ot transcribe <file>` — the whole product in one command.
 *
 * Artifacts ALWAYS land on disk. What comes back to the caller is the transcript
 * only when it is small; otherwise a receipt with paths and a section index. An
 * agent that receives a 20,000-word transcript has spent its context on the
 * least useful representation of the work.
 */
export const transcribe = async (
  options: TranscribeOptions
): Promise<number> => {
  const log = options.log ?? ((line: string) => console.log(line));
  const dir = options.configDir ?? defaultConfigDir();

  const store = await loadCredentials(dir);
  const credential = resolveCredential(store, { orgId: options.orgId });

  const client =
    options.client ??
    new OpenTranscription({
      apiKey: credential.apiKey,
      baseUrl: apiBaseUrl(),
    });

  const bytes = await readFile(options.file);
  const fileName = basename(options.file);

  const job = await client.transcribe({
    file: bytes,
    fileName,
    ...(options.model ? { model: options.model } : {}),
    ...(options.language ? { language: options.language } : {}),
    ...(options.diarize === undefined ? {} : { diarization: options.diarize }),
  });

  const finished = await client.waitForJob(job.id);

  const transcript = (finished.transcript ?? {}) as TranscriptPayload;
  const segments = transcript.segments ?? [];
  const text = transcript.text ?? segments.map((s) => s.text).join(' ');

  const stem = basename(fileName, extname(fileName));
  const target = options.outDir ?? dirname(options.file);
  const artifacts: Record<string, string> = {
    transcript: join(target, `${stem}.transcript.md`),
    json: join(target, `${stem}.json`),
  };
  if (segments.length > 0) {
    artifacts.srt = join(target, `${stem}.srt`);
    artifacts.vtt = join(target, `${stem}.vtt`);
  }

  await writeFile(artifacts.transcript!, markdown(segments, text), 'utf8');
  await writeFile(
    artifacts.json!,
    `${JSON.stringify(finished, null, 2)}\n`,
    'utf8'
  );
  if (artifacts.srt)
    await writeFile(artifacts.srt, formatSrt(segments), 'utf8');
  if (artifacts.vtt)
    await writeFile(artifacts.vtt, formatVtt(segments), 'utf8');

  const durationSeconds =
    typeof finished.duration_seconds === 'number'
      ? finished.duration_seconds
      : (segments.at(-1)?.end ?? 0);

  const summary = summarize({
    segments,
    text,
    artifacts,
    durationSeconds,
    model: String(finished.model_id ?? options.model ?? 'auto'),
  });

  log(summary.body);

  return 0;
};
