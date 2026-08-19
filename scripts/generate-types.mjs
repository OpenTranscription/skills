/**
 * Generate `packages/sdk/src/generated/api.ts` from the PUBLISHED OpenAPI spec.
 *
 * The spec is fetched over HTTP rather than read from a vendored copy or a git
 * submodule. The API lives in a private repo, so there is nothing to check out;
 * and a copy in this tree would be a second source of truth that drifts silently
 * the moment someone edits the API without remembering this package exists.
 *
 * Fetching from the live URL means a breaking contract change shows up as a
 * TypeScript error on the next `npm run typegen`, which is the point. It also
 * means this script needs the network — CI runs it and commits nothing, so a
 * drifted checkout fails the build rather than shipping stale types.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

const SPEC_URL =
  process.env.OT_SPEC_URL ?? 'https://opentranscription.io/openapi.json';

const OUT = fileURLToPath(
  new URL('../packages/sdk/src/generated/api.ts', import.meta.url)
);

const banner = `/**
 * GENERATED FILE — do not edit.
 *
 * Source: ${SPEC_URL}
 * Regenerate: npm run typegen
 */

`;

const main = async () => {
  const ast = await openapiTS(new URL(SPEC_URL));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, banner + astToString(ast), 'utf8');
  console.log(`wrote ${OUT}`);
};

await main();
