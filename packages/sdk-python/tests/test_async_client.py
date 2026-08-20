"""The async client.

Deliberately not a line-for-line copy of the sync suite. Everything those two
clients share is a pure function in `_core`, already covered once, and
`test_spec_parity` proves the two signatures have not drifted apart. What is
left to test here is the part that is genuinely different: the awaited I/O.
"""

from __future__ import annotations

import json

import httpx
import pytest
import respx

from opentranscription import ApiError, AsyncOpenTranscription, JobFailedError

BASE = "https://opentranscription.io"
UPLOAD_URL = "https://storage.example.com/signed/abc?token=secret"


async def anosleep(_seconds: float) -> None:
    return None


def client(**kwargs: object) -> AsyncOpenTranscription:
    kwargs.setdefault("sleep", anosleep)
    return AsyncOpenTranscription(api_key="ot_test", **kwargs)  # type: ignore[arg-type]


@pytest.fixture
def audio(tmp_path):
    path = tmp_path / "interview.mp3"
    path.write_bytes(b"ID3 fake audio")
    return path


@respx.mock
async def test_transcribe_runs_the_whole_round_trip(audio) -> None:
    respx.post(f"{BASE}/api/v1/uploads").mock(
        return_value=httpx.Response(
            200, json={"upload_url": UPLOAD_URL, "file_path": "org-1/interview.mp3"}
        )
    )
    put = respx.put(UPLOAD_URL).mock(return_value=httpx.Response(200))
    create = respx.post(f"{BASE}/api/v1/transcriptions").mock(
        return_value=httpx.Response(200, json={"id": "job-1", "status": "uploaded"})
    )

    async with client() as ot:
        job = await ot.transcribe(audio, model="auto/best", diarization=True)

    assert job["id"] == "job-1"
    assert put.calls.last.request.read() == b"ID3 fake audio"
    assert json.loads(create.calls.last.request.read()) == {
        "file_path": "org-1/interview.mp3",
        "model": "auto/best",
        "diarization": True,
    }


@respx.mock
async def test_never_sends_the_api_key_to_the_storage_host(audio) -> None:
    respx.post(f"{BASE}/api/v1/uploads").mock(
        return_value=httpx.Response(
            200, json={"upload_url": UPLOAD_URL, "file_path": "org-1/interview.mp3"}
        )
    )
    put = respx.put(UPLOAD_URL).mock(return_value=httpx.Response(200))
    respx.post(f"{BASE}/api/v1/transcriptions").mock(
        return_value=httpx.Response(200, json={"id": "job-1", "status": "uploaded"})
    )

    async with client() as ot:
        await ot.transcribe(audio, model="auto/best")

    assert "authorization" not in put.calls.last.request.headers


@respx.mock
async def test_does_not_follow_a_redirect_on_the_audio_upload(audio) -> None:
    """Same rule as the sync client: the body must not be resent elsewhere."""
    respx.post(f"{BASE}/api/v1/uploads").mock(
        return_value=httpx.Response(
            200, json={"upload_url": UPLOAD_URL, "file_path": "org-1/interview.mp3"}
        )
    )
    respx.put(UPLOAD_URL).mock(
        return_value=httpx.Response(
            308, headers={"location": "https://elsewhere.example.com/catch"}
        )
    )
    elsewhere = respx.put("https://elsewhere.example.com/catch").mock(
        return_value=httpx.Response(200)
    )

    async with client() as ot:
        with pytest.raises(ApiError) as caught:
            await ot.transcribe(audio, model="auto/best")

    assert caught.value.status == 308
    assert not elsewhere.called, "the audio was forwarded to the redirect target"


@respx.mock
async def test_wait_for_job_awaits_until_the_status_is_terminal() -> None:
    respx.get(f"{BASE}/api/v1/transcriptions/job-1").mock(
        side_effect=[
            httpx.Response(200, json={"id": "job-1", "status": "processing"}),
            httpx.Response(
                200,
                json={
                    "id": "job-1",
                    "status": "completed",
                    "transcript": {"text": "hello"},
                },
            ),
        ]
    )

    async with client() as ot:
        job = await ot.wait_for_job("job-1", poll_interval=0.01)

    assert job["transcript"]["text"] == "hello"


@respx.mock
async def test_wait_for_job_raises_with_the_failure_code() -> None:
    respx.get(f"{BASE}/api/v1/transcriptions/job-1").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "job-1",
                "status": "failed",
                "error": "Audio could not be decoded",
                "error_code": "invalid_audio",
            },
        )
    )

    async with client() as ot:
        with pytest.raises(JobFailedError) as caught:
            await ot.wait_for_job("job-1", poll_interval=0.01)

    assert caught.value.code == "invalid_audio"


@respx.mock
async def test_waits_out_a_429() -> None:
    slept: list[float] = []

    async def record(seconds: float) -> None:
        slept.append(seconds)

    respx.get(f"{BASE}/api/v1/transcriptions/job-1").mock(
        side_effect=[
            httpx.Response(429, headers={"retry-after": "3"}, json={}),
            httpx.Response(200, json={"id": "job-1", "status": "completed"}),
        ]
    )

    async with client(sleep=record) as ot:
        job = await ot.get_job("job-1")

    assert job["status"] == "completed"
    assert slept == [3.0]


@respx.mock
async def test_surfaces_the_api_error_code() -> None:
    respx.get(f"{BASE}/api/v1/models").mock(
        return_value=httpx.Response(
            401, json={"error": "Bad key", "code": "unauthorized"}
        )
    )

    async with client() as ot:
        with pytest.raises(ApiError) as caught:
            await ot.list_models()

    assert caught.value.status == 401
    assert caught.value.code == "unauthorized"


@respx.mock
async def test_the_context_manager_closes_the_transport() -> None:
    respx.get(f"{BASE}/api/v1/models").mock(
        return_value=httpx.Response(200, json={"data": {"models": []}})
    )

    async with client() as ot:
        await ot.list_models()

    assert ot.is_closed
