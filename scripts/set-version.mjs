#!/usr/bin/env node
// `node scripts/set-version.mjs 1.2.3` — how semantic-release stamps a release.
import { setVersion } from './setVersion.mjs';

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/set-version.mjs <version>');
  process.exit(2);
}

await setVersion(process.cwd(), version);
console.log(`Stamped ${version} across the workspace.`);
