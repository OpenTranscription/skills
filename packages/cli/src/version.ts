import { createRequire } from 'node:module';

/**
 * The version npm published, read from the manifest rather than duplicated as a
 * literal. `../package.json` resolves the same from `src/` and from `dist/`,
 * because both sit one level under the package root.
 */
export const cliVersion = (): string => {
  const require = createRequire(import.meta.url);
  const manifest = require('../package.json') as { version: string };
  return manifest.version;
};
