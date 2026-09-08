import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from './cli.js';
import { models } from './commands/catalog.js';
import { transcribe } from './commands/transcribe.js';
import { cliVersion } from './version.js';

vi.mock('./commands/catalog.js', () => ({
  models: vi.fn(async () => 0),
  jobs: vi.fn(async () => 0),
}));

vi.mock('./commands/transcribe.js', () => ({
  transcribe: vi.fn(async () => 0),
}));

const run = async (
  argv: string[]
): Promise<{ code: number; output: string; errors: string }> => {
  const lines: string[] = [];
  const errors: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...args) => {
    lines.push(args.join(' '));
  });
  const error = vi.spyOn(console, 'error').mockImplementation((...args) => {
    errors.push(args.join(' '));
  });

  try {
    return {
      code: await main(argv),
      output: lines.join('\n'),
      errors: errors.join('\n'),
    };
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
};

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('main', () => {
  /**
   * `--version` passes no positional, so the "no command given, show help"
   * branch used to swallow it — printing the whole help text and exiting 2.
   * A version flag that reports failure is worse than no version flag: it is
   * the first thing a bug report quotes and the first thing a package manager
   * scripts against.
   */
  it.each(['--version', '-v'])('prints the version for %s', async (flag) => {
    const { code, output } = await run([flag]);

    expect(output).toBe(cliVersion());
    expect(code).toBe(0);
  });

  it('still prints help and fails when no command is given', async () => {
    const { code, output } = await run([]);

    expect(output).toContain('Usage');
    expect(code).toBe(2);
  });

  it.each(['--help', '-h'])('prints help and succeeds for %s', async (flag) => {
    const { code, output } = await run([flag]);

    expect(output).toContain('Usage');
    expect(code).toBe(0);
  });
});

/**
 * Non-strict `parseArgs` ignores `type: 'string'` and hands back `true` for a
 * flag with no value. `--language` then crashed inside the catalogue, and
 * `--out` ran (and billed) the transcription before failing on `join(true)`.
 * A bad flag has to stop the command before it does anything.
 */
describe('main — flag parsing', () => {
  it('rejects --language with no value before reaching the catalogue', async () => {
    const { code, errors } = await run(['models', '--language']);

    expect(code).toBe(2);
    expect(errors).toContain('--language');
    expect(models).not.toHaveBeenCalled();
  });

  it('rejects --out with no value before transcribing anything', async () => {
    const { code, errors } = await run(['transcribe', 'a.mp3', '--out']);

    expect(code).toBe(2);
    expect(errors).toContain('--out');
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('rejects a misspelled flag instead of ignoring it', async () => {
    const { code, errors } = await run(['models', '--langauge', 'es']);

    expect(code).toBe(2);
    expect(errors).toContain('--langauge');
    expect(models).not.toHaveBeenCalled();
  });

  it('passes --language with a value through to the catalogue', async () => {
    const { code } = await run(['models', '--language', 'es']);

    expect(code).toBe(0);
    expect(models).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'es' })
    );
  });

  it('keeps boolean and hyphenated flags working under strict parsing', async () => {
    const { code } = await run([
      'transcribe',
      'a.mp3',
      '--diarize',
      '--vocab-list',
      'list-1',
    ]);

    expect(code).toBe(0);
    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({
        file: 'a.mp3',
        diarize: true,
        vocabList: 'list-1',
      })
    );
  });

  it('passes --no-word-timestamps through to the command', async () => {
    const { code } = await run(['transcribe', 'a.mp3', '--no-word-timestamps']);

    expect(code).toBe(0);
    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ noWordTimestamps: true })
    );
  });
});
