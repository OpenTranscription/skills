/**
 * What the CLI hands back to the agent.
 *
 * A transcript is the worst possible thing to return to a model: it is long,
 * mostly uninteresting, and it displaces the context the agent needs to actually
 * do the work. So the full artifacts always go to disk, and what comes back is
 * either the transcript (when it is small enough to be free) or a receipt that
 * says where things are and how to reach into them.
 *
 * The section index is DETERMINISTIC on purpose — speaker turns and silence
 * gaps, labelled with first sentences. No model call: a summarizer here would
 * make every transcription slow, non-reproducible, and billed twice.
 */

export type Segment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

export type Section = { start: number; label: string };

/** A pause at least this long reads as a topic change. */
const SILENCE_GAP_SECONDS = 8;

const MAX_LABEL_CHARS = 80;

/** Rough token estimate; ~4 chars per token is close enough to pick a branch. */
const INLINE_TOKEN_BUDGET = 2_000;

const firstSentence = (text: string): string => {
  const trimmed = text.trim();
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
  const candidate = match ? match[0] : trimmed;

  return candidate.length > MAX_LABEL_CHARS
    ? `${candidate.slice(0, MAX_LABEL_CHARS - 1).trimEnd()}…`
    : candidate;
};

export const buildSections = (segments: Segment[]): Section[] => {
  const sections: Section[] = [];
  let previous: Segment | undefined;

  for (const segment of segments) {
    const speakerChanged =
      previous !== undefined && segment.speaker !== previous.speaker;
    const longPause =
      previous !== undefined &&
      segment.start - previous.end >= SILENCE_GAP_SECONDS;

    if (previous === undefined || speakerChanged || longPause) {
      sections.push({
        start: segment.start,
        label: firstSentence(segment.text),
      });
    }

    previous = segment;
  }

  return sections;
};

const pad = (value: number, width = 2): string =>
  String(Math.floor(value)).padStart(width, '0');

const timestamp = (seconds: number, msSeparator: ',' | '.'): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${msSeparator}${pad(ms, 3)}`;
};

// Cues are separated by a BLANK line, and the file ends with a single newline.
// Players are forgiving about a missing trailing newline and unforgiving about a
// missing separator, which silently merges two cues into one.
export const formatSrt = (segments: Segment[]): string =>
  `${segments
    .map((segment, index) =>
      [
        String(index + 1),
        `${timestamp(segment.start, ',')} --> ${timestamp(segment.end, ',')}`,
        segment.text.trim(),
      ].join('\n')
    )
    .join('\n\n')}\n`;

export const formatVtt = (segments: Segment[]): string =>
  `WEBVTT\n\n${segments
    .map((segment) =>
      [
        `${timestamp(segment.start, '.')} --> ${timestamp(segment.end, '.')}`,
        segment.text.trim(),
      ].join('\n')
    )
    .join('\n\n')}\n`;

const humanDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h${pad(minutes)}m` : `${minutes}m`;
};

export type SummarizeInput = {
  segments: Segment[];
  text: string;
  artifacts: Record<string, string>;
  durationSeconds: number;
  model: string;
};

export type Summary = { inline: boolean; body: string };

export const summarize = (input: SummarizeInput): Summary => {
  const estimatedTokens = Math.ceil(input.text.length / 4);

  if (estimatedTokens <= INLINE_TOKEN_BUDGET) {
    return { inline: true, body: input.text.trim() };
  }

  const words = input.text.trim().split(/\s+/).length;
  const speakers = new Set(
    input.segments
      .map((segment) => segment.speaker)
      .filter((speaker): speaker is string => speaker !== undefined)
  );

  const lines = [
    `✓ transcribed  (${words.toLocaleString('en-US')} words · ${humanDuration(
      input.durationSeconds
    )} · ${input.model})`,
    '',
  ];

  // Omitted entirely when the model did not diarize. "speakers: 0" would read as
  // a finding about the audio rather than a fact about the request.
  if (speakers.size > 0) {
    lines.push(`${speakers.size} speakers`, '');
  }

  for (const [name, path] of Object.entries(input.artifacts)) {
    lines.push(`${name.padEnd(10)} ${path}`);
  }

  const sections = buildSections(input.segments);
  if (sections.length > 1) {
    lines.push('', 'Sections:');
    for (const section of sections) {
      lines.push(
        `  ${timestamp(section.start, '.').slice(0, 8)}  ${section.label}`
      );
    }
  }

  return { inline: false, body: lines.join('\n') };
};
