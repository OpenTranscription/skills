# OpenTranscription skills

[![cli](https://img.shields.io/npm/v/@opentranscription/cli?label=cli)](https://www.npmjs.com/package/@opentranscription/cli)
[![sdk](https://img.shields.io/npm/v/@opentranscription/sdk?label=sdk)](https://www.npmjs.com/package/@opentranscription/sdk)
[![node](https://img.shields.io/node/v/@opentranscription/cli)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@opentranscription/cli)](./LICENSE)

Give your coding agent the ability to transcribe audio. Agent Skill, CLI, and
typed SDK for [OpenTranscription](https://opentranscription.io).

Works in Claude Code, Codex, Cursor, Gemini CLI, VS Code / Copilot, Windsurf,
Cline, and Zed.

```
npx skills add opentranscription/skills
npm install -g @opentranscription/cli
ot login
ot transcribe interview.mp3
```

An hour-long meeting comes back like this:

```
$ ot transcribe meeting.mp3

✓ transcribed  (8,000 words · 59m · auto/best)

3 speakers

transcript meeting.txt
srt        meeting.srt
vtt        meeting.vtt

Sections:
  00:00:00  So the migration is the thing I keep coming back to.
  00:01:01  Let me pull the numbers before we decide anything.
  00:15:40  I can have the dashboard ready by Thursday.
```

The transcript, subtitles, and section index are on disk. The agent spent a
filename instead of the ~10,400 tokens that transcript would have cost it, and
it knows where to look next.

## Why a CLI and not an API call

Transcripts are long, and a model that reads one has spent its context on the
least useful shape of the work. `ot` always writes the artifacts to disk and
hands back either the transcript (when it is short) or a receipt: word count,
duration, model, file paths, and a section index of timestamps built from
speaker turns and silence gaps.

The section index is computed, not summarized. No second model call, so it costs
nothing and returns the same thing every time.

## What this is

Three things that share one core:

|                              |                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| **The skill**                | `skills/transcribing-audio` — teaches an agent when and how to reach for transcription |
| **`@opentranscription/cli`** | the `ot` command, which is what the skill actually runs                                |
| **`@opentranscription/sdk`** | the typed client, if you would rather write the code yourself                          |

## Where it works

The skill follows the [Agent Skills](https://agentskills.dev) spec and bundles no
scripts, so it works anywhere `ot` is on `PATH`.

**It does not work in hosted sandboxes** — Claude on the web or mobile, and
similar environments without outbound network access. The whole job is calling an
API, so there is nothing for it to do there. This is a terminal-and-IDE tool.

## Commands

```
ot login [--org <id>]     sign in through your browser
ot whoami                 which workspaces are signed in
ot switch <org-id>        choose which one commands use
ot logout [--org <id>]    forget one workspace, or all

ot transcribe <file>      the whole product
  --diarize               label speakers
  --model auto/best       or auto/cheapest, or a specific model id
  --language es           skip language detection
  --out <dir>             write artifacts somewhere else
```

Each API key belongs to exactly one workspace, so `ot` stores one key per
workspace and refuses to run against a workspace you have not logged into
rather than quietly using another one.

## Using the SDK

```ts
import { OpenTranscription } from '@opentranscription/sdk';

const ot = new OpenTranscription({ apiKey: process.env.OT_API_KEY! });

const job = await ot.transcribe({
  file: await readFile('interview.mp3'),
  fileName: 'interview.mp3',
  model: 'auto/best',
});

const done = await ot.waitForJob(job.id);
```

Types are generated from the published OpenAPI document, so a contract change
shows up as a compile error rather than a surprise at runtime.

## Contributing

Setup, the test gate, and how releases work are in
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

Releases are published by GitHub Actions through npm
[trusted publishing](https://docs.npmjs.com/trusted-publishers). There is no npm
token, in CI or anywhere else: the workflow exchanges a short-lived OIDC token
for publish rights scoped to this repository and one workflow file, so there is
no long-lived credential to leak.

Every release carries a [provenance](https://docs.npmjs.com/generating-provenance-statements)
attestation linking the published tarball to the commit and workflow run that
built it. Check one yourself:

```bash
npm view @opentranscription/cli dist.attestations
```

## License

MIT
