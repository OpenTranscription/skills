---
name: transcribing-audio
description: Transcribes audio files to text with speaker labels, timestamps, and SRT/VTT subtitles using OpenTranscription's catalog of speech-to-text models. Use when the user has an audio file (mp3, wav, m4a, flac, ogg, webm), voice memo, recorded meeting, interview, lecture, or podcast to transcribe, or asks to caption, subtitle, or diarize audio.
---

# Transcribing audio

Use the `ot` command. It uploads the file, waits for the job, writes the
transcript and subtitles to disk, and prints either the text or a short receipt.

## Before the first run

Check the command exists:

```
ot --version
```

If that fails, install it:

```
npm install -g @opentranscription/cli
```

If `npm` is also missing, stop and tell the user Node.js 20+ is required —
guessing at a package manager wastes a turn and usually installs nothing.

Then check for a signed-in account:

```
ot whoami
```

If it says "Not signed in", run `ot login`. It prints a code and a URL and waits
for the user to approve in a browser. **This needs a human.** Show them the code
and the URL from the output and wait — do not try to complete it yourself.

## Transcribing

```
ot transcribe path/to/audio.mp3
```

Useful flags:

| Flag                    | When                                                  |
| ----------------------- | ----------------------------------------------------- |
| `--diarize`             | more than one speaker, or the user asks who said what |
| `--model auto/best`     | accuracy matters more than cost                       |
| `--model auto/cheapest` | long file, rough transcript is fine                   |
| `--language es`         | you know the language; skips detection                |
| `--out <dir>`           | write artifacts somewhere other than beside the audio |

Run `ot models` to see what is available with prices and measured accuracy.

## Reading the output

Artifacts are always written next to the audio (or to `--out`):

- `<name>.transcript.md` — the text, with speaker labels when diarized
- `<name>.srt` / `<name>.vtt` — subtitles
- `<name>.json` — the full job, including per-word timings

**Short audio**: the transcript is printed directly. Use it.

**Long audio**: a receipt is printed instead — word count, duration, model, the
artifact paths, and a section index of timestamps. This is deliberate. Read the
sections to find what matters, then open just that part of the transcript file
rather than loading the whole thing.

## When something goes wrong

The command exits non-zero and prints one sentence saying what to do. Common
cases:

- **not signed in** → `ot login`
- **no credential for that workspace** → `ot login --org <id>`; never retry with
  a different workspace, the command refuses on purpose
- **out of credits or free minutes** → the user has to add credits on the web app
- **file too large** → the API caps uploads at 100 MiB; split the file or
  re-encode it smaller
- **video file** → the API takes audio only; extract first with
  `ffmpeg -i in.mp4 -vn -ac 1 -ar 16000 -c:a libmp3lame out.mp3`

More detail in [references/troubleshooting.md](references/troubleshooting.md).

## Do not

- Do not print a full transcript back to the user unless they asked for it — the
  file path is usually the useful answer.
- Do not transcribe the same file twice to "check" a result; it costs money and
  returns the same thing.
- Do not pass `--model` a name you have not seen in `ot models`.
