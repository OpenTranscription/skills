"""Everything the sync and async clients share that does not touch the network.

Both clients are thin I/O wrappers over this module. Keeping the decisions here
means there is one place where a rule lives, rather than two that agree until
someone edits one of them.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import IO, Any, Union

import httpx

from ._errors import ApiError

# The API is served from the apex, not an `api.` subdomain: this is the
# `servers` entry in the published OpenAPI document.
DEFAULT_BASE_URL = "https://opentranscription.io"

#: Seconds between polls in `wait_for_job`.
DEFAULT_POLL_INTERVAL = 2.0

#: How many times a 429 is waited out before the caller hears about it.
RATE_LIMIT_RETRIES = 4

#: Longest we will honour an `X-RateLimit-Reset` for, in seconds.
MAX_RATE_LIMIT_WAIT = 60.0

#: Statuses the API will never move away from.
TERMINAL = frozenset({"completed", "failed", "cancelled"})

#: Statuses a job can still leave. Together with TERMINAL these must cover the
#: API's whole `JobStatus` union, which `tests/test_spec_parity.py` checks
#: against the generated types: a status in neither set reads as still-running,
#: so `wait_for_job` would poll a finished job until the caller gave up.
#:
#: `queued` is deliberately absent. That is AssemblyAI's provider-side status,
#: not ours. A new job here starts at `uploaded`.
IN_FLIGHT = frozenset({"pending_upload", "uploaded", "processing"})

MIME_BY_EXTENSION = {
    "mp3": "audio/mpeg",
    "m4a": "audio/mp4",
    "mp4": "audio/mp4",
    "wav": "audio/wav",
    "flac": "audio/flac",
    "ogg": "audio/ogg",
    "opus": "audio/opus",
    "webm": "audio/webm",
}

#: Request fields `transcribe` deliberately does not offer.
#:
#: `file_path` is the server's name for the uploaded object; `transcribe`
#: supplies it from the upload response and a caller may not invent one.
#: `duration` is client-declared and can only ever RAISE the credit hold, and a
#: caller here holds a file rather than a decoded duration, so offering it
#: invites a wrong guess for no gain. `router` is a nested
#: strategy-and-constraints object; `model="auto/best"` covers the common case
#: and the full router is its own design.
#:
#: `tests/test_spec_parity.py` fails if one of these leaves the API, so this
#: cannot decay into a graveyard of names nobody recognises.
DECLINED_FIELDS = frozenset({"file_path", "duration", "router"})

FileInput = Union[str, "os.PathLike[str]", bytes, bytearray, IO[bytes]]

Job = dict[str, Any]
CatalogModel = dict[str, Any]


class NotGiven:
    """The absence of an argument, for parameters where `None` is a real value.

    `audio_retention_days=None` means "retain indefinitely" and
    `diarization=False` means "force diarization off". Neither can double as
    "the caller said nothing", so the default has to be a third thing.
    """

    _instance: NotGiven | None = None

    def __new__(cls) -> NotGiven:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __bool__(self) -> bool:
        return False

    def __repr__(self) -> str:
        return "NOT_GIVEN"


NOT_GIVEN = NotGiven()


def content_type_for(file_name: str) -> str:
    """The audio MIME type implied by a file name."""
    _, _, extension = file_name.rpartition(".")
    return MIME_BY_EXTENSION.get(extension.lower(), "application/octet-stream")


def resolve_file(file: FileInput, file_name: str | None) -> tuple[bytes, str]:
    """Read the audio, and settle on the name it is uploaded under.

    Accepts a path, an open binary file, or raw bytes. Raw bytes carry no name,
    and the name decides both the declared filename and the Content-Type, so
    inventing one would silently upload `application/octet-stream`.
    """
    if isinstance(file, (bytes, bytearray)):
        if not file_name:
            raise ValueError("file_name is required when passing raw bytes")
        return bytes(file), file_name

    if hasattr(file, "read"):
        handle: IO[bytes] = file  # type: ignore[assignment]
        data = handle.read()
        if file_name:
            return data, file_name
        name = getattr(handle, "name", None)
        if not isinstance(name, str):
            raise ValueError("file_name is required for a stream with no name")
        return data, os.path.basename(name)

    path = os.fspath(file)
    with open(path, "rb") as opened:
        return opened.read(), file_name or os.path.basename(path)


def build_request(file_path: str, options: Mapping[str, Any]) -> dict[str, Any]:
    """The `POST /transcriptions` body: the server's file_path plus what was given.

    Only `NOT_GIVEN` counts as absent. `False` and `None` are values the API
    reads, and dropping either applies the opposite policy to the one asked for.

    `file_path` is written last so a caller who somehow passes one cannot
    redirect the job at another organisation's object.
    """
    request = {
        key: value for key, value in options.items() if not isinstance(value, NotGiven)
    }
    request["file_path"] = file_path
    return request


def retry_after_seconds(
    headers: Mapping[str, str], now: float, fallback: float
) -> float:
    """How long the server wants us to wait.

    `Retry-After` is seconds; `X-RateLimit-Reset` is an epoch second. Neither
    usable means waiting the poll interval rather than hammering immediately.

    Today the API sends only the second: the rate limiter sets
    `X-RateLimit-{Limit,Remaining,Reset}` and no `Retry-After`. The first branch
    is kept because it is the standard header and costs nothing, but it is not
    the one that fires.
    """
    try:
        retry_after = float(headers["retry-after"])
        if retry_after > 0:
            return retry_after
    except (KeyError, TypeError, ValueError):
        pass

    try:
        delta = float(headers["x-ratelimit-reset"]) - now
        if delta > 0:
            return min(delta, MAX_RATE_LIMIT_WAIT)
    except (KeyError, TypeError, ValueError):
        pass

    return fallback


def is_terminal(status: str) -> bool:
    return status in TERMINAL


def api_error(response: httpx.Response) -> ApiError:
    """Turn a non-2xx response into an `ApiError`, whatever shape its body is in."""
    try:
        body = response.json()
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {}

    message = body.get("error")
    code = body.get("code")
    return ApiError(
        message if isinstance(message, str) else response.reason_phrase,
        response.status_code,
        code if isinstance(code, str) else None,
    )


def normalize_base_url(base_url: str | None) -> str:
    return (base_url or DEFAULT_BASE_URL).rstrip("/")


def job_or_raise(job: Job) -> Job | None:
    """`None` while the job is still running; the job once it is done.

    Raises `JobFailedError` on a failed job, so both poll loops treat failure
    the same way without either of them deciding what failure means.
    """
    from ._errors import JobFailedError

    if not is_terminal(str(job.get("status", ""))):
        return None
    if job.get("status") == "failed":
        raise JobFailedError(job)
    return job
