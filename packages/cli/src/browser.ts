import { spawn } from 'node:child_process';

/**
 * Open a URL in the user's browser, best-effort.
 *
 * Never throws and never blocks: the CLI has already printed the URL, so a
 * failure here costs the user a copy-paste, not a login. Agents in particular
 * often run with no desktop session at all.
 */
export const openBrowser = (url: string): void => {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];

  try {
    const child = spawn(command as string, args as string[], {
      stdio: 'ignore',
      detached: true,
    });
    child.on('error', () => {
      /* No browser, no session, no problem — the URL is already on screen. */
    });
    child.unref();
  } catch {
    /* Same. */
  }
};
