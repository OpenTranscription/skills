# @opentranscription/cli

Transcribe audio from your terminal, or from a coding agent that has a shell.

```bash
npm install -g @opentranscription/cli
ot login
ot transcribe meeting.mp3
```

Requires Node 22 or newer.

## Why a CLI

Agents run out of context long before they run out of audio. `ot transcribe`
writes the transcript, the SRT, the VTT and a section index to disk and prints a
short receipt, so a two-hour recording costs the agent a filename instead of
40,000 tokens. Short recordings still print inline, because a receipt for eight
seconds of audio is worse than the audio.

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

`ot login` uses the OAuth device flow: it prints a code, opens your browser, and
you approve the terminal from a page you are already signed in to. No key is
pasted anywhere. Keys are stored per workspace in
`~/.config/opentranscription/`, mode `0600`.

## Reading long transcripts

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

## Environment

- `OT_API_URL` — point at a different API host. Defaults to `https://opentranscription.io`.
- `OT_CONFIG_DIR` — where credentials live. Defaults to `$XDG_CONFIG_HOME/opentranscription`, or `~/.config/opentranscription`.

## License

MIT
