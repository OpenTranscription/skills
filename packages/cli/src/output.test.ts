import { describe, expect, it } from 'vitest';

import { buildSections, formatSrt, formatVtt, summarize } from './output.js';

const seg = (
  start: number,
  end: number,
  text: string,
  speaker?: string
): { start: number; end: number; text: string; speaker?: string } =>
  speaker === undefined ? { start, end, text } : { start, end, text, speaker };

describe('buildSections', () => {
  /**
   * The section index is what lets an agent jump into a long transcript without
   * reading it. It has to be DETERMINISTIC — no model call — or the CLI becomes
   * slow, non-reproducible, and billable twice for one transcription.
   */
  it('starts a new section when the speaker changes after a real turn', () => {
    const sections = buildSections([
      seg(0, 40, 'Welcome to the show.', 'A'),
      seg(40, 80, 'Glad to be here.', 'B'),
      seg(80, 120, 'Let us start with the budget.', 'A'),
    ]);

    expect(sections).toEqual([
      { start: 0, label: 'Welcome to the show.' },
      { start: 40, label: 'Glad to be here.' },
      { start: 80, label: 'Let us start with the budget.' },
    ]);
  });

  it('starts a new section after a long silence', () => {
    const sections = buildSections([
      seg(0, 4, 'First topic.'),
      seg(4, 8, 'Still the first topic.'),
      seg(40, 44, 'A new topic entirely.'),
    ]);

    expect(sections).toEqual([
      { start: 0, label: 'First topic.' },
      { start: 40, label: 'A new topic entirely.' },
    ]);
  });

  /**
   * Found by running this against a real 6-minute recording: rapid back-and-forth
   * dialogue produced a section every two seconds, with labels like "Where?" and
   * "To—". A section index that dense is a second transcript, not a way to
   * navigate one, so sections have a minimum length.
   */
  it('does not start a section for every turn of a rapid exchange', () => {
    const rapid = [
      seg(0, 2, 'I am sorry.', 'A'),
      seg(2, 4, 'Just email it.', 'B'),
      seg(4, 6, 'Where?', 'A'),
      seg(6, 8, 'With his mom.', 'B'),
      seg(8, 10, 'No, with his mom.', 'A'),
    ];

    expect(buildSections(rapid)).toHaveLength(1);
  });

  it('starts a new section once enough time has passed', () => {
    const sections = buildSections([
      seg(0, 4, 'Opening.', 'A'),
      seg(4, 8, 'Reply.', 'B'),
      seg(40, 44, 'A genuinely later topic.', 'A'),
    ]);

    expect(sections.map((s) => s.start)).toEqual([0, 40]);
  });

  it('labels a section with its first sentence, not its whole text', () => {
    const [section] = buildSections([
      seg(
        0,
        30,
        'The quarterly numbers came in. Revenue was up, churn was flat, and nobody expected either.'
      ),
    ]);

    expect(section!.label).toBe('The quarterly numbers came in.');
  });

  it('truncates a label that has no sentence break', () => {
    const [section] = buildSections([seg(0, 30, 'a'.repeat(200))]);

    expect(section!.label.length).toBeLessThanOrEqual(80);
    expect(section!.label.endsWith('…')).toBe(true);
  });

  it('returns nothing for an empty transcript rather than one empty section', () => {
    expect(buildSections([])).toEqual([]);
  });
});

describe('summarize', () => {
  const shortSegments = [seg(0, 3, 'Hello there.', 'A')];

  it('returns the transcript inline when it is small enough to be cheap', () => {
    const result = summarize({
      segments: shortSegments,
      text: 'Hello there.',
      artifacts: { transcript: '/tmp/a.transcript.md' },
      durationSeconds: 3,
      model: 'openai/whisper-large-v3',
    });

    expect(result.inline).toBe(true);
    expect(result.body).toContain('Hello there.');
  });

  it('returns a receipt instead of the transcript once it is large', () => {
    const text = 'word '.repeat(20_000);
    const result = summarize({
      segments: [seg(0, 3600, text, 'A')],
      text,
      artifacts: {
        transcript: '/tmp/a.transcript.md',
        srt: '/tmp/a.srt',
      },
      durationSeconds: 3600,
      model: 'openai/whisper-large-v3',
    });

    expect(result.inline).toBe(false);
    expect(result.body).not.toContain(text);
    expect(result.body).toContain('/tmp/a.transcript.md');
    expect(result.body).toContain('/tmp/a.srt');
  });

  /**
   * Diarization is optional on OTUS — `speaker` is not always present. Printing
   * "speakers: 0" or "speakers: unknown" would read as a finding about the audio
   * rather than a fact about the request, so the line is omitted entirely.
   */
  it('says nothing about speakers when the model did not diarize', () => {
    const text = 'word '.repeat(20_000);
    const result = summarize({
      segments: [seg(0, 3600, text)],
      text,
      artifacts: { transcript: '/tmp/a.transcript.md' },
      durationSeconds: 3600,
      model: 'm',
    });

    expect(result.body.toLowerCase()).not.toContain('speaker');
  });

  it('reports the speaker count when the model did diarize', () => {
    const text = 'word '.repeat(20_000);
    const result = summarize({
      segments: [seg(0, 1800, text, 'A'), seg(1800, 3600, 'More.', 'B')],
      text,
      artifacts: { transcript: '/tmp/a.transcript.md' },
      durationSeconds: 3600,
      model: 'm',
    });

    expect(result.body).toContain('2 speakers');
  });
});

describe('subtitle formats', () => {
  const segments = [seg(0, 2.5, 'First line.'), seg(2.5, 5, 'Second line.')];

  it('numbers SRT cues from 1 and uses comma milliseconds', () => {
    expect(formatSrt(segments)).toBe(
      [
        '1',
        '00:00:00,000 --> 00:00:02,500',
        'First line.',
        '',
        '2',
        '00:00:02,500 --> 00:00:05,000',
        'Second line.',
        '',
      ].join('\n')
    );
  });

  it('writes a WEBVTT header and dot milliseconds', () => {
    const vtt = formatVtt(segments);

    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.500');
  });

  it('keeps hours in the timestamp for long audio', () => {
    expect(formatSrt([seg(3661.5, 3663, 'Late.')])).toContain(
      '01:01:01,500 --> 01:01:03,000'
    );
  });
});
