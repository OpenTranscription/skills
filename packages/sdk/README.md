# @opentranscription/sdk

Typed client for the [OpenTranscription](https://opentranscription.io) API. Upload a
file, transcribe it against any model in the catalogue, and wait for the result.

```bash
npm install @opentranscription/sdk
```

Requires Node 22 or newer. The types are generated from the published OpenAPI
spec, so they track the live API rather than a hand-written guess.

## Usage

```ts
import { readFile } from 'node:fs/promises';
import { OpenTranscription } from '@opentranscription/sdk';

const ot = new OpenTranscription({ apiKey: process.env.OT_API_KEY! });

const job = await ot.transcribe({
  file: await readFile('meeting.mp3'),
  fileName: 'meeting.mp3',
  model: 'auto/best', // or a concrete id from listModels()
  diarization: true,
});

const done = await ot.waitForJob(job.id);
console.log(done.transcript?.text);
```

`transcribe` does three things: requests a signed upload URL, PUTs the bytes
straight to storage, and creates the job. The API key never travels to the
storage host.

## API

| Method                     | Purpose                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `transcribe(input)`        | Upload and create a job. Returns immediately, before transcription finishes.         |
| `waitForJob(id, options?)` | Poll until the job completes. Throws `JobFailedError` if it fails.                   |
| `getJob(id)`               | Read one job, including its transcript once ready.                                   |
| `listJobs(limit?)`         | Recent jobs, newest first.                                                           |
| `listModels()`             | The public model catalogue: pricing, accuracy, supported languages. No key required. |

`new OpenTranscription({ apiKey, baseUrl?, fetch?, sleep? })` — `fetch` and
`sleep` are injectable so callers can test without network or real waiting.

Rate limits (429) are retried automatically, honouring `Retry-After` and then
`X-RateLimit-Reset`, up to four waits.

## Errors

- `ApiError` — a non-2xx response. Carries `status` and, when the API sent one, `code`.
- `JobFailedError` — the job reached a terminal failure. Carries the `Job`, whose `error_code` says why.

## Getting a key

Create one in your [dashboard](https://opentranscription.io/settings/keys),
or run `npx @opentranscription/cli login` to mint one through the browser.

## License

MIT
