# OpenTranscription skills

Transcribe audio from your coding agent — the Agent Skill, CLI, and SDK for
[OpenTranscription](https://opentranscription.io).

```
npx skills add opentranscription/skills
npm install -g @opentranscription/cli
ot login
ot transcribe interview.mp3
```

## What this is

Three things that share one core:

| | |
| --- | --- |
| **The skill** | `skills/transcribing-audio` — teaches an agent when and how to reach for transcription |
| **`@opentranscription/cli`** | the `ot` command, which is what the skill actually runs |
| **`@opentranscription/sdk`** | the typed client, if you would rather write the code yourself |

## Where it works

The skill follows the [Agent Skills](https://agentskills.dev) spec and bundles no
scripts, so it works anywhere `ot` is on `PATH`: Claude Code, Codex, Gemini CLI,
Cursor, VS Code / Copilot, Windsurf, Cline, and Zed.

**It does not work in hosted sandboxes** — Claude on the web or mobile, and
similar environments without outbound network access. The whole job is calling an
API, so there is nothing for it to do there. This is a terminal-and-IDE tool.

## Why a CLI and not an API call

Transcripts are long, and a model that reads one has spent its context on the
least useful shape of the work. `ot` always writes the artifacts to disk and
hands back either the transcript (when it is short) or a receipt: word count,
duration, model, file paths, and a section index of timestamps built from
speaker turns and silence gaps.

The section index is computed, not summarized. No second model call, so it costs
nothing and returns the same thing every time.

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

## Development

```
npm install
npm test
npm run build
npm run typegen    # regenerate types from the live spec
```

MIT licensed.
