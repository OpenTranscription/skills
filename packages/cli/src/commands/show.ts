import { OpenTranscription } from '@opentranscription/sdk';

import {
  defaultConfigDir,
  loadCredentials,
  resolveCredential,
} from '../credentials.js';
import { apiBaseUrl } from '../env.js';
import { type Segment } from '../output.js';

export type ShowOptions = {
  jobId: string;
  from?: string | undefined;
  to?: string | undefined;
  orgId?: string | undefined;
  configDir?: string;
  log?: (line: string) => void;
  client?: Pick<OpenTranscription, 'getJob'>;
};

/**
 * Accepts `90`, `1:30`, or `1:02:03`. An agent reading a section index sees
 * `00:12:30` and should be able to paste it straight back.
 */
export const parseTimecode = (value: string): number => {
  const parts = value.split(':').map(Number);

  if (parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Not a timecode: ${value}`);
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
};

/**
 * `ot show <job> [--from] [--to]` — read part of a transcript.
 *
 * The slicing happens HERE, not on the server: there is no range endpoint, and
 * inventing one in the client would be a lie about the API. The bytes still land
 * in this process rather than in the agent's context, which is the point.
 */
export const show = async (options: ShowOptions): Promise<number> => {
  const log = options.log ?? ((line: string) => console.log(line));

  const client =
    options.client ??
    (await (async () => {
      const store = await loadCredentials(
        options.configDir ?? defaultConfigDir()
      );
      const credential = resolveCredential(store, { orgId: options.orgId });
      return new OpenTranscription({
        apiKey: credential.apiKey,
        baseUrl: apiBaseUrl(),
      });
    })());

  const job = await client.getJob(options.jobId);
  const transcript = (job.transcript ?? {}) as {
    text?: string;
    segments?: Segment[];
  };
  const segments = transcript.segments ?? [];

  if (segments.length === 0) {
    if (transcript.text) {
      log(transcript.text.trim());
      return 0;
    }
    log(`Job ${options.jobId} has no transcript (status: ${job.status}).`);
    return 1;
  }

  const from = options.from ? parseTimecode(options.from) : 0;
  const to = options.to ? parseTimecode(options.to) : Number.POSITIVE_INFINITY;

  // Overlap, not containment: a segment straddling the boundary is what the
  // caller asked to read, and dropping it silently loses the sentence they
  // pointed at.
  const slice = segments.filter(
    (segment) => segment.end > from && segment.start < to
  );

  if (slice.length === 0) {
    log('Nothing in that range.');
    return 1;
  }

  let speaker: string | undefined;
  for (const segment of slice) {
    if (segment.speaker !== undefined && segment.speaker !== speaker) {
      log(`\n**${segment.speaker}**`);
      speaker = segment.speaker;
    }
    log(segment.text.trim());
  }

  return 0;
};
