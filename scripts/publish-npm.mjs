#!/usr/bin/env node
// `node scripts/publish-npm.mjs 1.2.3` — how semantic-release publishes to npm.
import { publishNpm } from './publishNpm.mjs';

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/publish-npm.mjs <version>');
  process.exit(2);
}

await publishNpm(version);
