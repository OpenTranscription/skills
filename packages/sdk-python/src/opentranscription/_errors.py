"""What this client raises, and why the two are not the same failure."""

from __future__ import annotations

from typing import Any


class OpenTranscriptionError(Exception):
    """Base class, so `except OpenTranscriptionError` catches everything we raise."""


class ApiError(OpenTranscriptionError):
    """A non-2xx response, carrying whatever the API told us.

    `code` is the machine-readable cause when the API sent one. Branch on it
    rather than on `str(error)`, which is prose and may be translated or
    reworded.
    """

    def __init__(self, message: str, status: int, code: str | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code


class JobFailedError(OpenTranscriptionError):
    """The job ran and failed.

    Distinct from `ApiError` because the request itself succeeded, so retrying
    it is pointless. `code` is what tells a caller whether to re-encode the
    audio, pick another model, or give up.
    """

    def __init__(self, job: dict[str, Any]) -> None:
        super().__init__(job.get("error") or "Transcription failed")
        self.job = job
        self.code = job.get("error_code")
