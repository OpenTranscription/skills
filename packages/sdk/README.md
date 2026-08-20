<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OpenTranscription/skills/main/assets/banner-dark.png">
  <img alt="OpenTranscription. Every speech-to-text model worth using. One command." src="https://raw.githubusercontent.com/OpenTranscription/skills/main/assets/banner-light.png">
</picture>

# @opentranscription/sdk

[![npm](https://img.shields.io/npm/v/@opentranscription/sdk)](https://www.npmjs.com/package/@opentranscription/sdk)
[![node](https://img.shields.io/node/v/@opentranscription/sdk)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@opentranscription/sdk)](../../LICENSE)

Typed client for the [OpenTranscription](https://opentranscription.io) API. Upload a
file, transcribe it against any model in the catalogue, and wait for the result.

```bash
npm install @opentranscription/sdk
```

The types are generated from the published OpenAPI spec, so they track the live
API. A nightly job regenerates them and fails the build on any drift.

## Usage

```ts
import { readFile } from 'node:fs/promises';
import { OpenTranscription } from '@opentranscription/sdk';

const ot = new OpenTranscription({ apiKey: process.env.OT_API_KEY! });

const job = await ot.transcribe({
  file: await readFile('earnings-call.mp3'),
  fileName: 'earnings-call.mp3',

  // Primary plus backups, tried in order when a provider fails. Use `model`
  // instead for a single id, or for `auto/best`, `auto/cheapest`, `auto/fastest`.
  models: ['assemblyai/best', 'deepgram/nova-3'],

  language: 'en',
  diarization: true,

  // Names and jargon the model has the weakest prior for, which are usually the
  // reason you wanted the transcript.
  customWords: ['EBITDA', 'Sanjay Bhattacharya', 'Nasdaq', 'ARR'],
});

const done = await ot.waitForJob(job.id);
console.log(done.transcript?.text);
```

`transcribe` does three things: requests a signed upload URL, PUTs the bytes
straight to storage, and creates the job. The API key never travels to the
storage host.

## Request fields

`file` and `fileName` are required. Everything else is optional, and omitting a
field is not the same as passing `false` or `null`: omitted means the server's
own default applies.

| Field                              | Notes                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `model`                            | One id, or `auto/best`, `auto/cheapest`, `auto/fastest`. Use this or `models`, not both.                                                                                 |
| `models`                           | Two to five ids: primary first, backups tried in order when one fails.                                                                                                   |
| `language`                         | ISO 639-1, two letters. Omit to let the model detect it.                                                                                                                 |
| `diarization`                      | `true` forces speaker labels on, `false` forces them off, omitted follows the model's own default.                                                                       |
| `customWords`                      | Up to 1000 terms, 100 characters each. Only models whose `capabilities.features` list `custom_vocabulary` read them; the rest ignore them instead of failing.            |
| `vocabularyListId`                 | A list saved in the web app, under Settings then Vocabulary. Merged with `customWords` when both are given.                                                              |
| `codeSwitching`                    | Audio that changes language mid-sentence.                                                                                                                                |
| `codeSwitchingConfidenceThreshold` | 0 to 1. AssemblyAI only; ignored elsewhere.                                                                                                                              |
| `webhookUrl`                       | Public HTTPS URL for a signed `transcription.completed` event, so a long job needs no `waitForJob`.                                                                      |
| `metadata`                         | Returned untouched on the job. Yours to correlate with.                                                                                                                  |
| `title`                            | Display name in the web app. Falls back to the file name.                                                                                                                |
| `useOwnKey`                        | Bill the provider directly against your own key instead of platform credits.                                                                                             |
| `audioRetentionDays`               | Whole days, `0` to delete on completion, or `null` to keep indefinitely. Omitting it leaves the organization default in force, which is why `null` is a real value here. |
| `customModelId`                    | A fine-tuned model you uploaded, by id.                                                                                                                                  |

Every one of these is checked at compile time against types generated from the
published OpenAPI document, so a field the API renames stops compiling and a
field it adds that this client does not map fails the build by name.

## API

| Method                     | Purpose                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transcribe(input)`        | Upload and create a job. Returns immediately, before transcription finishes.                                                                                           |
| `waitForJob(id, options?)` | Poll until the job completes. Throws `JobFailedError` if it fails. `options` takes `pollIntervalMs` (default 2000) and an `AbortSignal`. There is no built-in timeout. |
| `getJob(id)`               | Read one job, including its transcript once ready.                                                                                                                     |
| `listJobs(limit?)`         | Recent jobs, newest first.                                                                                                                                             |
| `listModels()`             | The public model catalogue: pricing, accuracy, supported languages. No key required.                                                                                   |

`new OpenTranscription({ apiKey, baseUrl?, fetch?, sleep? })` takes an injectable
`fetch` and `sleep`, so callers can test without network or real waiting.
`baseUrl` defaults to `https://opentranscription.io`.

Rate limits (429) are retried automatically, honouring `Retry-After` and then
`X-RateLimit-Reset`, up to four waits. A single `transcribe` can trip a
ten-per-minute limit on its own, since it is an upload, a create, and then a
poll every couple of seconds.

## Errors

- `ApiError` is a non-2xx response. It carries `status` and, when the API sent one, `code`.
- `JobFailedError` means the job ran and failed, so retrying the request is pointless. It carries `code` (also on `job.error_code`), which is what tells you whether to re-encode the audio, pick another model, or give up.

## Getting a key

Create one in your [dashboard](https://opentranscription.io/settings/keys),
or run `npx @opentranscription/cli login` to mint one through the browser.

Requires Node 22 or newer. Published with
[provenance](https://docs.npmjs.com/generating-provenance-statements), so every
release links to the commit and workflow run that built it.

## License

MIT
