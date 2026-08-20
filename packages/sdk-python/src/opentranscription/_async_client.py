"""The asynchronous client.

A mirror of `_client.py` with awaited I/O. The two `transcribe` signatures are
written out separately so editors and type checkers can complete them, and
`tests/test_spec_parity.py` compares them on every run so that duplication
cannot quietly become a difference.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable, Mapping, Sequence
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


class AsyncOpenTranscription:
    """The async twin of `OpenTranscription`.

        from opentranscription import AsyncOpenTranscription

        async with AsyncOpenTranscription(api_key="ot_...") as ot:
            job = await ot.transcribe("interview.mp3", model="auto/best")
            done = await ot.wait_for_job(job["id"])

    Use the context manager, or call `aclose()` yourself, or the connection
    pool outlives the work.
    """

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str | None = None,
        timeout: float = 60.0,
        http_client: httpx.AsyncClient | None = None,
        sleep: Callable[[float], Awaitable[None]] | None = None,
    ) -> None:
        self._base_url = normalize_base_url(base_url)
        self._sleep = sleep or asyncio.sleep
        self._owns_client = http_client is None
        # httpx does not follow redirects by default; `fetch`, which the
        # TypeScript client uses, does. Left at the httpx default that is an
        # accidental difference between the two clients, and it fails opaquely:
        # a 3xx is not `is_success`, so a redirect surfaces as an ApiError on a
        # response that is not an error. httpx strips the Authorization header
        # on a cross-origin redirect itself, so following costs no credential.
        # That reasoning covers headers only, which is why the audio upload
        # opts back out: see the PUT in `transcribe`.
        self._http = http_client or httpx.AsyncClient(
            timeout=timeout, follow_redirects=True
        )
        self._headers = {
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        }

    # -- lifecycle ---------------------------------------------------------

    async def __aenter__(self) -> AsyncOpenTranscription:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._http.aclose()

    @property
    def is_closed(self) -> bool:
        return self._http.is_closed

    # -- transport ---------------------------------------------------------

    async def _api(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        """See `OpenTranscription._api`: same rule, awaited."""
        for attempt in range(RATE_LIMIT_RETRIES + 1):
            response = await self._http.request(
                method, f"{self._base_url}{path}", headers=self._headers, **kwargs
            )

            if response.is_success:
                body = response.json()
                return body if isinstance(body, dict) else {}

            if response.status_code == 429 and attempt < RATE_LIMIT_RETRIES:
                await self._sleep(
                    retry_after_seconds(
                        response.headers, time.time(), DEFAULT_POLL_INTERVAL
                    )
                )
                continue

            raise api_error(response)

        raise AssertionError("unreachable")

    # -- the API -----------------------------------------------------------

    async def transcribe(
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
        """Upload the audio and open a job. See `OpenTranscription.transcribe`."""
        data, name = resolve_file(file, file_name)
        content_type = content_type_for(name)

        upload = await self._api(
            "POST",
            "/api/v1/uploads",
            json={
                "file_name": name,
                "file_size": len(data),
                "mime_type": content_type,
            },
        )

        # Not through `_api`: the signed URL must never see the API key, and
        # `follow_redirects=False` keeps the AUDIO from being resent to a
        # redirect target. See `OpenTranscription.transcribe`.
        stored = await self._http.put(
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

        return await self._api("POST", "/api/v1/transcriptions", json=request)

    async def get_job(self, job_id: str) -> Job:
        return await self._api("GET", f"/api/v1/transcriptions/{job_id}")

    async def list_jobs(self, limit: int = 10) -> list[Job]:
        body = await self._api("GET", "/api/v1/transcriptions", params={"limit": limit})
        data = body.get("data")
        return data if isinstance(data, list) else []

    async def list_models(self) -> list[CatalogModel]:
        body = await self._api("GET", "/api/v1/models")
        data = body.get("data")
        models = data.get("models") if isinstance(data, dict) else None
        return models if isinstance(models, list) else []

    async def wait_for_job(
        self, job_id: str, *, poll_interval: float = DEFAULT_POLL_INTERVAL
    ) -> Job:
        """Poll until the job finishes. Raises `JobFailedError` if it failed."""
        while True:
            done = job_or_raise(await self.get_job(job_id))
            if done is not None:
                return done
            await self._sleep(poll_interval)
