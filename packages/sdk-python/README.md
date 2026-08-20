<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OpenTranscription/skills/main/assets/banner-dark.png">
  <img alt="OpenTranscription. Every speech-to-text model worth using. One command." src="https://raw.githubusercontent.com/OpenTranscription/skills/main/assets/banner-light.png">
</picture>

# opentranscription

[![PyPI](https://img.shields.io/pypi/v/opentranscription)](https://pypi.org/project/opentranscription/)
[![Python](https://img.shields.io/pypi/pyversions/opentranscription)](https://pypi.org/project/opentranscription/)
[![License](https://img.shields.io/pypi/l/opentranscription)](https://github.com/OpenTranscription/skills/blob/main/LICENSE)

Python client for the [OpenTranscription](https://opentranscription.io) API. Upload a
file, transcribe it against any model in the catalogue, and wait for the result.

```bash
pip install opentranscription
```

## Usage

```python
from opentranscription import OpenTranscription

ot = OpenTranscription(api_key=os.environ["OT_API_KEY"])

job = ot.transcribe(
    "earnings-call.mp3",
    # Primary plus backups, tried in order when a provider fails. Use `model`
    # instead for a single id, or for auto/best, auto/cheapest, auto/fastest.
    models=["assemblyai/best", "deepgram/nova-3"],
    language="en",
    diarization=True,
    # Names and jargon the model has the weakest prior for, which are usually
    # the reason you wanted the transcript.
    custom_words=["EBITDA", "Sanjay Bhattacharya", "Nasdaq", "ARR"],
)

done = ot.wait_for_job(job["id"])
print(done["transcript"]["text"])
```

`transcribe` does three things: requests a signed upload URL, PUTs the bytes
straight to storage, and creates the job. The API key never travels to the
storage host.

The first argument is a path, an open binary file, or raw `bytes` with
`file_name=` alongside it.

### async

The same surface, awaited. Both classes come from one package and share their
implementation.

```python
from opentranscription import AsyncOpenTranscription

async with AsyncOpenTranscription(api_key=os.environ["OT_API_KEY"]) as ot:
    job = await ot.transcribe("earnings-call.mp3", model="auto/best")
    done = await ot.wait_for_job(job["id"])
```

Use the context manager, on either class, or the connection pool outlives the
work. The sync client also has `close()`, the async one `aclose()`.

## Request fields

The audio is required. Everything else is optional, and leaving a field out is
not the same as passing `False` or `None`: left out means the server's own
default applies.

| Field                                 | Notes                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `model`                               | One id, or `auto/best`, `auto/cheapest`, `auto/fastest`. Use this or `models`, not both.                                                                                 |
| `models`                              | Two to five ids: primary first, backups tried in order when one fails.                                                                                                   |
| `language`                            | ISO 639-1, two letters. Omit to let the model detect it.                                                                                                                 |
| `diarization`                         | `True` forces speaker labels on, `False` forces them off, omitted follows the model's own default.                                                                       |
| `custom_words`                        | Up to 1000 terms, 100 characters each. Only models whose `capabilities.features` list `custom_vocabulary` read them; the rest ignore them instead of failing.            |
| `vocabulary_list_id`                  | A list saved in the web app, under Settings then Vocabulary. Merged with `custom_words` when both are given.                                                             |
| `code_switching`                      | Audio that changes language mid-sentence.                                                                                                                                |
| `code_switching_confidence_threshold` | 0 to 1. AssemblyAI only; ignored elsewhere.                                                                                                                              |
| `webhook_url`                         | Public HTTPS URL for a signed `transcription.completed` event, so a long job needs no `wait_for_job`.                                                                    |
| `metadata`                            | Returned untouched on the job. Yours to correlate with.                                                                                                                  |
| `title`                               | Display name in the web app. Falls back to the file name.                                                                                                                |
| `use_own_key`                         | Bill the provider directly against your own key instead of platform credits.                                                                                             |
| `audio_retention_days`                | Whole days, `0` to delete on completion, or `None` to keep indefinitely. Omitting it leaves the organization default in force, which is why `None` is a real value here. |
| `custom_model_id`                     | A fine-tuned model you uploaded, by id.                                                                                                                                  |

That last row is why the defaults are `NOT_GIVEN` rather than `None`. `None`
already means something to the API on two of these fields, so it cannot also
mean "the caller said nothing".

The field list is checked against the published OpenAPI document on every test
run. A field the API adds that this client does not offer fails the build by
name, and so does one this client offers that the API no longer accepts.

## API

| Method                                | Purpose                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `transcribe(file, **fields)`          | Upload and create a job. Returns immediately, before transcription finishes.                                          |
| `wait_for_job(job_id, poll_interval)` | Poll until the job completes. Raises `JobFailedError` if it fails. `poll_interval` is seconds, default 2. No timeout. |
| `get_job(job_id)`                     | Read one job, including its transcript once ready.                                                                    |
| `list_jobs(limit)`                    | Recent jobs, newest first.                                                                                            |
| `list_models()`                       | The public model catalogue: pricing, accuracy, supported languages.                                                   |

`OpenTranscription(api_key, base_url=..., timeout=..., http_client=..., sleep=...)`
accepts your own `httpx.Client` when you need custom transport, proxies, or
retries, and an injectable `sleep` so tests need no real waiting. `base_url`
defaults to `https://opentranscription.io`.

Passing your own client means your settings, not ours: the `follow_redirects`
default this sets is yours to decide. The audio upload opts out of redirects
per request either way, so that one is not yours to get wrong.

Rate limits (429) are retried automatically, up to four waits. The API sends
`X-RateLimit-Reset` (an epoch second) and that is what paces the retry;
`Retry-After` is honoured first if a response ever carries one. A single `transcribe` can trip a
ten-per-minute limit on its own, since it is an upload, a create, and then a
poll every couple of seconds.

## Errors

- `ApiError` is a non-2xx response. It carries `status` and, when the API sent one, `code`.
- `JobFailedError` means the job ran and failed, so retrying the request is pointless. It carries `code` (also on `job["error_code"]`), which is what tells you whether to re-encode the audio, pick another model, or give up.
- Both subclass `OpenTranscriptionError`.

Branch on `code`, not on the message, which is prose and may be reworded.

## Getting a key

Create one in your [dashboard](https://opentranscription.io/settings/keys), or
run `npx @opentranscription/cli login` to mint one through the browser.

Requires Python 3.10 or newer, and `httpx`.

## License

MIT
