#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { jobs, models } from '../commands/catalog.js';
import { login } from '../commands/login.js';
import { logout } from '../commands/logout.js';
import { switchOrg, whoami } from '../commands/session.js';
import { show } from '../commands/show.js';
import { transcribe } from '../commands/transcribe.js';
import { MissingCredentialError } from '../credentials.js';
import { DeviceFlowError } from '../deviceFlow.js';
import { cliVersion } from '../version.js';

const HELP = `ot — transcribe audio from your terminal

Usage
  ot login [--org <id>]        sign in (opens your browser)
  ot logout [--org <id>]       forget one workspace, or all of them
  ot whoami                    show signed-in workspaces
  ot switch <org-id>           choose which workspace commands use

  ot models [--language es]    list models with prices
  ot jobs [--limit 10]         recent transcriptions
  ot show <job-id>             print a transcript
    --from 1:30 --to 4:00      only part of it

  ot transcribe <file>         transcribe audio; writes artifacts next to it
    --model <id>               e.g. auto/best, auto/cheapest, openai/whisper-large-v3
    --language <code>          force a language instead of detecting it
    --diarize                  label speakers
    --out <dir>                write artifacts somewhere else

Options
  -h, --help                   show this
  -v, --version                show the version
`;

const options = {
  org: { type: 'string' },
  model: { type: 'string' },
  language: { type: 'string' },
  out: { type: 'string' },
  diarize: { type: 'boolean' },
  all: { type: 'boolean' },
  limit: { type: 'string' },
  from: { type: 'string' },
  to: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const;

const main = async (argv: string[]): Promise<number> => {
  const { values, positionals } = parseArgs({
    args: argv,
    options,
    allowPositionals: true,
    strict: false,
  });

  const [command, target] = positionals;

  if (values.help || command === undefined || command === 'help') {
    console.log(HELP);
    return command === undefined && !values.help ? 2 : 0;
  }

  if (values.version) {
    console.log(cliVersion());
    return 0;
  }

  switch (command) {
    case 'login':
      return login({ orgId: values.org as string | undefined });

    case 'logout':
      return logout({
        orgId: values.org as string | undefined,
        all: values.all === true,
      });

    case 'whoami':
      return whoami();

    case 'switch':
      return switchOrg(target);

    case 'models':
      return models({
        orgId: values.org as string | undefined,
        language: values.language as string | undefined,
      });

    case 'jobs':
      return jobs({
        orgId: values.org as string | undefined,
        ...(values.limit === undefined ? {} : { limit: Number(values.limit) }),
      });

    case 'show': {
      if (!target) {
        console.error('Usage: ot show <job-id> [--from 1:30] [--to 4:00]');
        return 2;
      }
      return show({
        jobId: target,
        from: values.from as string | undefined,
        to: values.to as string | undefined,
        orgId: values.org as string | undefined,
      });
    }

    case 'transcribe': {
      if (!target) {
        console.error('Usage: ot transcribe <file>');
        return 2;
      }
      return transcribe({
        file: target,
        orgId: values.org as string | undefined,
        model: values.model as string | undefined,
        language: values.language as string | undefined,
        outDir: values.out as string | undefined,
        diarize: values.diarize as boolean | undefined,
      });
    }

    default:
      console.error(`Unknown command: ${command}\n`);
      console.error(HELP);
      return 2;
  }
};

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
