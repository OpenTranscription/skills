#!/usr/bin/env node
import { main } from '../cli.js';
import { MissingCredentialError } from '../credentials.js';
import { DeviceFlowError } from '../deviceFlow.js';

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
    if (
      error instanceof MissingCredentialError ||
      error instanceof DeviceFlowError
    ) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    console.error(
      error instanceof Error ? error.message : 'Something went wrong.'
    );
    process.exitCode = 1;
  });
