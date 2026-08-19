import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from './cli.js';
import { cliVersion } from './version.js';

const runCapturingStdout = async (
  argv: string[]
): Promise<{ code: number; output: string }> => {
  const lines: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...args) => {
    lines.push(args.join(' '));
  });

  try {
    return { code: await main(argv), output: lines.join('\n') };
  } finally {
    log.mockRestore();
  }
};

afterEach(() => {
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
    const { code, output } = await runCapturingStdout([flag]);

    expect(output).toBe(cliVersion());
    expect(code).toBe(0);
  });

  it('still prints help and fails when no command is given', async () => {
    const { code, output } = await runCapturingStdout([]);

    expect(output).toContain('Usage');
    expect(code).toBe(2);
  });

  it('prints help and succeeds for --help', async () => {
    const { code, output } = await runCapturingStdout(['--help']);

    expect(output).toContain('Usage');
    expect(code).toBe(0);
  });
});
