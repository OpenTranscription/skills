#!/usr/bin/env node
import { main } from '../cli.js';
import { describeError } from '../errorMessage.js';

/**
 * Every expected failure becomes a plain sentence and a non-zero exit. An agent
 * reading a stack trace learns nothing it can act on, and a stack trace in the
 * transcript is worse than the error.
 */
main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(describeError(error));
    process.exitCode = 1;
  });
