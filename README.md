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

|                              |                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| **The skill**                | `skills/transcribing-audio` — teaches an agent when and how to reach for transcription |
| **`@opentranscription/cli`** | the `ot` command, which is what the skill actually runs                                |
| **`@opentranscription/sdk`** | the typed client, if you would rather write the code yourself                          |

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
npm run typecheck
npm run lint
npm test
npm run build
npm run typegen    # regenerate types from the live spec
```

Husky runs the same gate the product repo does: `lint-staged` on commit (eslint
`--fix` then prettier, on staged files only), commitlint on the message, and
typecheck plus lint plus the full suite on push. CI runs the identical steps, so
a green pre-push means a green build.

## Releasing

Merging to `main` releases. [semantic-release](https://semantic-release.gitbook.io)
reads the commit messages, picks the next version, tags, cuts a GitHub release
with the notes, and publishes both packages to npm. Nobody edits a version
number by hand.

**The changelog is the [Releases page](https://github.com/OpenTranscription/skills/releases),
not a file in the repo.** A committed `CHANGELOG.md` would only restate what the
tag and the release already say, and it costs a `chore(release)` commit on `main`
every time.

Which means the commit message _is_ the release decision:

| Commit type                                           | Effect     |
| ----------------------------------------------------- | ---------- |
| `feat:`                                               | minor bump |
| `fix:`, `perf:`, `refactor:`, `revert:`               | patch bump |
| `docs:`, `style:`, `test:`, `build:`, `ci:`, `chore:` | no release |
| any type with `BREAKING CHANGE:` in the body          | major bump |

commitlint enforces the format twice: a husky `commit-msg` hook locally, and a
CI job over every commit in a pull request, because the hook is skippable and a
malformed type fails silently — it cuts no release at all rather than erroring.

Both packages share one version and are always published together. `ot` pins
`@opentranscription/sdk` to an exact version, and `scripts/setVersion.mjs` keeps
that pin in step with the bump; a stale pin would ship a CLI wired to the
previous SDK, which the workspace symlink hides from every local test.

Releasing needs one repository secret, `NPM_TOKEN` — an npm **automation** token
for the `@opentranscription` org, since a publish token that prompts for 2FA
cannot work unattended.

MIT licensed.
