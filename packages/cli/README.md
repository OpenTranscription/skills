<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OpenTranscription/skills/main/assets/banner-dark.png">
  <img alt="OpenTranscription CLI — transcribe audio from your terminal" src="https://raw.githubusercontent.com/OpenTranscription/skills/main/assets/banner-light.png">
</picture>

# @opentranscription/cli

[![npm](https://img.shields.io/npm/v/@opentranscription/cli)](https://www.npmjs.com/package/@opentranscription/cli)
[![node](https://img.shields.io/node/v/@opentranscription/cli)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@opentranscription/cli)](../../LICENSE)

Transcribe audio from your terminal. Built for coding agents that have a shell,
and perfectly usable by hand.

```bash
npm install -g @opentranscription/cli
ot login
ot transcribe meeting.mp3
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

Everything is on disk. The agent spent a filename, not the ~10,400 tokens that
transcript would have cost it, and it knows where to look. Short recordings
print inline instead, because a receipt for eight seconds of audio is worse
than the audio.

## Commands

```
ot login [--org <id>]        sign in (opens your browser)
ot logout [--org <id>]       forget one workspace, or all of them
ot whoami                    show signed-in workspaces
ot switch <org-id>           choose which workspace commands use
ot transcribe <file>         transcribe audio or video
ot jobs                      recent transcriptions
ot show <job-id>             read a transcript, or part of one
ot models                    the model catalogue
```

## Reading part of a transcript

```bash
ot show <job-id> --from 12:30 --to 18:00
```

Slicing happens locally against the transcript the job already produced, so
reading a section twice costs nothing.

## Choosing a model

```bash
ot models --language es
ot transcribe interview.wav --model auto/cheapest --diarize
```

`auto/best` and `auto/cheapest` route for you. `ot models` lists everything else
with per-minute pricing and measured accuracy.

## Signing in

`ot login` uses the OAuth device flow: it prints a code, opens your browser, and
you approve the terminal from a page you are already signed in to. No key is
pasted anywhere. Credentials are stored per workspace in
`~/.config/opentranscription/`, mode `0600`.

## Environment

- `OT_API_URL` — point at a different API host. Defaults to `https://opentranscription.io`.
- `OT_CONFIG_DIR` — where credentials live. Defaults to `$XDG_CONFIG_HOME/opentranscription`, or `~/.config/opentranscription`.

Requires Node 22 or newer. Published with
[provenance](https://docs.npmjs.com/generating-provenance-statements), so every
release links to the commit and workflow run that built it.

## License

MIT
