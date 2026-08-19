# Troubleshooting `ot`

Read this when a command failed and the one-line message was not enough.

## Login

**`ot login` prints a code and then nothing happens.**
The flow waits for a human to approve in a browser. Nothing will change until
someone opens the URL, signs in, picks a workspace and clicks approve. If no
browser opened, the URL in the output is the whole thing — it can be opened on
any device.

**"The code expired before it was approved."**
The code is good for 15 minutes. Run `ot login` again for a fresh one.

**"Authorization was declined in the browser."**
Someone clicked cancel. Nothing was issued.

**Approval succeeded but the workspace is wrong.**
Each key belongs to exactly one workspace, fixed when it is issued. Run
`ot login --org <id>` to add a key for a second workspace; that does not sign
you out of the first. `ot whoami` lists what is stored, `ot switch <id>` changes
which one commands use by default.

## Workspaces

**"No credential stored for organization X."**
There is no key for that workspace, so the command stopped rather than using a
different one. This is deliberate: an API key is bound to its workspace at
issue time, so falling back would silently run the command against the wrong
account with a perfectly valid credential. Fix it with `ot login --org X`.

## Transcription

**"Free minutes exhausted" / "Insufficient credits."**
Billing is per second of audio. Free minutes reset monthly; credits do not
expire on a schedule. Both are topped up on the web app — the CLI cannot do it.

**The job failed.**
The output includes a machine-readable code. `AUDIO_DECODE_FAILED` usually means
the container says one thing and the bytes say another; re-encoding fixes most
of them:

```
ffmpeg -i broken.m4a -ac 1 -ar 16000 -c:a libmp3lame fixed.mp3
```

**The file is a video.**
The API accepts audio only. Extract the track first:

```
ffmpeg -i talk.mp4 -vn -ac 1 -ar 16000 -c:a libmp3lame talk.mp3
```

**The file is over 100 MiB.**
That is the upload cap. Re-encoding to 16 kHz mono MP3 shrinks most recordings
by an order of magnitude without hurting accuracy — speech models downsample to
16 kHz anyway.

**Speaker labels are missing.**
Diarization is off by default and not every model supports it. Pass `--diarize`,
and check `ot models` for a model that lists diarization.

**The transcript is in the wrong language.**
Detection works from the first stretch of audio, so a long English intro on a
Spanish recording can throw it. Pass `--language es` to skip detection.

## Environment

**`ot: command not found` after installing.**
The npm global bin directory is not on `PATH`. `npm bin -g` prints it. As a
fallback, `npx @opentranscription/cli` works without a global install, at the
cost of a slower start.

**Nothing works and there is no network.**
The CLI talks to `api.opentranscription.io`. In a sandbox without outbound
network — some hosted agent environments — no amount of retrying will help. This
is a terminal-and-IDE tool.

**Pointing at a different API.**
`OT_API_URL` overrides the endpoint and `OT_CONFIG_DIR` overrides where
credentials are stored. Both are for testing against staging; neither is needed
in normal use.
