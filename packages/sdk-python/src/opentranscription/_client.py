"""The synchronous client."""

from __future__ import annotations

import time
from collections.abc import Callable, Mapping, Sequence
from types import TracebackType
from typing import Any

import httpx

from ._core import (
    DEFAULT_POLL_INTERVAL,
    NOT_GIVEN,
    RATE_LIMIT_RETRIES,
    CatalogModel,
    FileInput,
    Job,
    NotGiven,
    api_error,
    build_request,
    content_type_for,
    job_or_raise,
    normalize_base_url,
    resolve_file,
    retry_after_seconds,
)
from ._errors import ApiError


class OpenTranscription:
    """Upload audio, open a transcription job, and read the result.

        from opentranscription import OpenTranscription

        ot = OpenTranscription(api_key="ot_...")
        job = ot.transcribe("interview.mp3", model="auto/best")
        print(ot.wait_for_job(job["id"])["transcript"]["text"])

    Usable as a context manager, which closes the underlying connection pool.
    """

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str | None = None,
        timeout: float = 60.0,
        http_client: httpx.Client | None = None,
        sleep: Callable[[float], None] | None = None,
    ) -> None:
        self._base_url = normalize_base_url(base_url)
        self._sleep = sleep or time.sleep
        self._owns_client = http_client is None
        # httpx does not follow redirects by default; `fetch`, which the
        # TypeScript client uses, does. Left at the httpx default that is an
        # accidental difference between the two clients, and it fails opaquely:
        # a 3xx is not `is_success`, so a redirect surfaces as an ApiError on a
        # response that is not an error. httpx strips the Authorization header
        # on a cross-origin redirect itself, so following costs no credential.
        # That reasoning covers headers only, which is why the audio upload
        # opts back out: see the PUT in `transcribe`.
        self._http = http_client or httpx.Client(timeout=timeout, follow_redirects=True)
        self._headers = {
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        }

    # -- lifecycle ---------------------------------------------------------

    def __enter__(self) -> OpenTranscription:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()

    def close(self) -> None:
        """Close the connection pool, unless the caller supplied their own client."""
        if self._owns_client:
            self._http.close()

    @property
    def is_closed(self) -> bool:
        return self._http.is_closed

    # -- transport ---------------------------------------------------------

    def _api(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        """One authenticated request, waiting out a 429 rather than raising it.

        A single `transcribe` is three calls on its own, plus a poll every
        couple of seconds, so it can trip a per-minute limit through this
        client's own pacing. Surfacing that to the caller would be blaming them
        for it. The server says when to come back; we wait that long, a bounded
        number of times, and only give up if it keeps saying no.
        """
        for attempt in range(RATE_LIMIT_RETRIES + 1):
            response = self._http.request(
                method, f"{self._base_url}{path}", headers=self._headers, **kwargs
            )

            if response.is_success:
                body = response.json()
                return body if isinstance(body, dict) else {}

            if response.status_code == 429 and attempt < RATE_LIMIT_RETRIES:
                self._sleep(
                    retry_after_seconds(
                        response.headers, time.time(), DEFAULT_POLL_INTERVAL
                    )
                )
                continue

            raise api_error(response)

        raise AssertionError("unreachable")

    # -- the API -----------------------------------------------------------

    def transcribe(
        self,
        file: FileInput,
        *,
        file_name: str | None = None,
        model: str | NotGiven = NOT_GIVEN,
        models: Sequence[str] | NotGiven = NOT_GIVEN,
        language: str | NotGiven = NOT_GIVEN,
        diarization: bool | NotGiven = NOT_GIVEN,
        custom_words: Sequence[str] | NotGiven = NOT_GIVEN,
        vocabulary_list_id: str | NotGiven = NOT_GIVEN,
        code_switching: bool | NotGiven = NOT_GIVEN,
        code_switching_confidence_threshold: float | NotGiven = NOT_GIVEN,
        webhook_url: str | NotGiven = NOT_GIVEN,
        metadata: Mapping[str, Any] | NotGiven = NOT_GIVEN,
        title: str | NotGiven = NOT_GIVEN,
        use_own_key: bool | NotGiven = NOT_GIVEN,
        audio_retention_days: int | None | NotGiven = NOT_GIVEN,
        custom_model_id: str | NotGiven = NOT_GIVEN,
    ) -> Job:
        """Upload the audio and open a transcription job for it.

        `file` is a path, an open binary file, or raw bytes with `file_name`.

        Pass either `model` (one id, or `auto/best`, `auto/cheapest`,
        `auto/fastest`) or `models` (a fallback chain of two to five concrete
        ids), never both. Omit `language` to let the model detect it.

        Every parameter left out is left out of the request, which is not the
        same as sending `None`: `audio_retention_days=None` asks the API to keep
        the audio indefinitely, and `diarization=False` forces speaker labels
        off on a model that would otherwise add them.

        Returns the job, which starts out `uploaded`. Follow it with `wait_for_job`,
        or give `webhook_url` and let the completed event come to you.
        """
        data, name = resolve_file(file, file_name)
        content_type = content_type_for(name)

        upload = self._api(
            "POST",
            "/api/v1/uploads",
            # The API's field names, not ours. The route answers a bare
            # "Validation error" when any of the three is missing or misspelled.
            json={
                "file_name": name,
                "file_size": len(data),
                "mime_type": content_type,
            },
        )

        # Deliberately NOT through `_api`: the URL is already signed, so
        # attaching the API key would send a live credential to a host that
        # never needs it.
        #
        # `follow_redirects=False` overrides the client default, and it is about
        # the BODY, not the key. httpx resends the body on a 307/308, so a
        # redirect here would hand the user's audio to whatever `Location`
        # points at. The credential-stripping that justifies following
        # elsewhere protects headers and says nothing about payloads. A signed
        # upload URL has no legitimate reason to redirect a PUT.
        stored = self._http.put(
            upload["upload_url"],
            content=data,
            headers={"content-type": content_type},
            follow_redirects=False,
        )
        if not stored.is_success:
            raise ApiError("Upload failed", stored.status_code)

        request = build_request(
            upload["file_path"],
            {
                "model": model,
                "models": models,
                "language": language,
                "diarization": diarization,
                "custom_words": custom_words,
                "vocabulary_list_id": vocabulary_list_id,
                "code_switching": code_switching,
                "code_switching_confidence_threshold": (
                    code_switching_confidence_threshold
                ),
                "webhook_url": webhook_url,
                "metadata": metadata,
                "title": title,
                "use_own_key": use_own_key,
                "audio_retention_days": audio_retention_days,
                "custom_model_id": custom_model_id,
            },
        )

        return self._api("POST", "/api/v1/transcriptions", json=request)

    def get_job(self, job_id: str) -> Job:
        return self._api("GET", f"/api/v1/transcriptions/{job_id}")

    def list_jobs(self, limit: int = 10) -> list[Job]:
        """Recent jobs, newest first."""
        body = self._api("GET", "/api/v1/transcriptions", params={"limit": limit})
        data = body.get("data")
        return data if isinstance(data, list) else []

    def list_models(self) -> list[CatalogModel]:
        """The public catalogue: ids, pricing, languages, measured accuracy.

        The payload is `{"data": {"models": [...]}}`, one level deeper than the
        other list routes put theirs.
        """
        body = self._api("GET", "/api/v1/models")
        data = body.get("data")
        models = data.get("models") if isinstance(data, dict) else None
        return models if isinstance(models, list) else []

    def wait_for_job(
        self, job_id: str, *, poll_interval: float = DEFAULT_POLL_INTERVAL
    ) -> Job:
        """Poll until the job finishes. Raises `JobFailedError` if it failed."""
        while True:
            done = job_or_raise(self.get_job(job_id))
            if done is not None:
                return done
            self._sleep(poll_interval)
