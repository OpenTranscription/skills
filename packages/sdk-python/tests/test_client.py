"""The sync client, against a mocked API."""

from __future__ import annotations

import json

import httpx
import pytest
import respx

from opentranscription import ApiError, JobFailedError, OpenTranscription

BASE = "https://opentranscription.io"
UPLOAD_URL = "https://storage.example.com/signed/abc?token=secret"

# The status a freshly created job really carries. `queued` is a
# provider-side word that this API never emits.
CREATED = {"id": "job-1", "status": "uploaded"}


def upload_route() -> respx.Route:
    return respx.post(f"{BASE}/api/v1/uploads").mock(
        return_value=httpx.Response(
            200, json={"upload_url": UPLOAD_URL, "file_path": "org-1/interview.mp3"}
        )
    )


def put_route() -> respx.Route:
    return respx.put(UPLOAD_URL).mock(return_value=httpx.Response(200))


def create_route() -> respx.Route:
    return respx.post(f"{BASE}/api/v1/transcriptions").mock(
        return_value=httpx.Response(200, json=CREATED)
    )


def client(**kwargs: object) -> OpenTranscription:
    kwargs.setdefault("sleep", lambda _seconds: None)
    return OpenTranscription(api_key="ot_test", **kwargs)  # type: ignore[arg-type]


def sent_body(route: respx.Route) -> dict:
    return json.loads(route.calls.last.request.read())


@pytest.fixture
def audio(tmp_path):
    path = tmp_path / "interview.mp3"
    path.write_bytes(b"ID3 fake audio")
    return path


class TestTranscribe:
    @respx.mock
    def test_uploads_the_bytes_then_opens_the_job(self, audio) -> None:
        uploads = upload_route()
        put = put_route()
        create = create_route()

        job = client().transcribe(audio, model="auto/best", language="en")

        assert job["id"] == "job-1"

        # The upload route answers a bare "Validation error" when any of these
        # three is missing or misspelled, so they are pinned rather than trusted.
        assert sent_body(uploads) == {
            "file_name": "interview.mp3",
            "file_size": 14,
            "mime_type": "audio/mpeg",
        }
        assert put.calls.last.request.read() == b"ID3 fake audio"
        assert sent_body(create) == {
            "file_path": "org-1/interview.mp3",
            "model": "auto/best",
            "language": "en",
        }

    @respx.mock
    def test_never_sends_the_api_key_to_the_storage_host(self, audio) -> None:
        # The upload URL is already signed. Attaching the key would hand a live
        # credential to a host that never needs it.
        upload_route()
        put = put_route()
        create_route()

        client().transcribe(audio, model="auto/best")

        assert "authorization" not in put.calls.last.request.headers
        assert put.calls.last.request.headers["content-type"] == "audio/mpeg"

    @respx.mock
    def test_passes_every_option_through_under_its_api_name(self, audio) -> None:
        upload_route()
        put_route()
        create = create_route()

        client().transcribe(
            audio,
            model="auto/best",
            diarization=False,
            custom_words=["Kubernetes"],
            audio_retention_days=None,
            webhook_url="https://example.com/hook",
        )

        body = sent_body(create)
        assert body["diarization"] is False
        assert body["custom_words"] == ["Kubernetes"]
        assert body["audio_retention_days"] is None
        assert body["webhook_url"] == "https://example.com/hook"

    @respx.mock
    def test_raises_when_the_storage_put_fails(self, audio) -> None:
        upload_route()
        respx.put(UPLOAD_URL).mock(return_value=httpx.Response(403))

        with pytest.raises(ApiError) as caught:
            client().transcribe(audio, model="auto/best")

        assert caught.value.status == 403

    @respx.mock
    def test_accepts_raw_bytes_with_a_name(self) -> None:
        upload_route()
        put_route()
        create_route()

        assert client().transcribe(b"raw audio", file_name="clip.mp3")["id"] == "job-1"


class TestErrors:
    @respx.mock
    def test_surfaces_the_status_and_the_machine_readable_code(self) -> None:
        respx.get(f"{BASE}/api/v1/transcriptions/job-1").mock(
            return_value=httpx.Response(
                402,
                json={"error": "Insufficient credits", "code": "insufficient_credits"},
            )
        )

        with pytest.raises(ApiError) as caught:
            client().get_job("job-1")

        assert caught.value.status == 402
        assert caught.value.code == "insufficient_credits"
        assert "Insufficient credits" in str(caught.value)

    @respx.mock
    def test_falls_back_to_the_status_text_when_the_body_is_not_json(self) -> None:
        respx.get(f"{BASE}/api/v1/transcriptions/job-1").mock(
            return_value=httpx.Response(502, text="<html>bad gateway</html>")
        )

        with pytest.raises(ApiError) as caught:
            client().get_job("job-1")

        assert caught.value.status == 502
        assert caught.value.code is None


class TestRateLimiting:
    @respx.mock
    def test_waits_out_a_429_instead_of_blaming_the_caller(self) -> None:
        # One transcribe is three calls on its own, so the free tier's limit is
        # reachable by this client's own pacing.
        slept: list[float] = []
        respx.get(f"{BASE}/api/v1/transcriptions/job-1").mock(
            side_effect=[
                httpx.Response(429, headers={"retry-after": "3"}, json={}),
                httpx.Response(200, json={"id": "job-1", "status": "completed"}),
            ]
        )

        job = client(sleep=slept.append).get_job("job-1")

        assert job["status"] == "completed"
        assert slept == [3.0]

    @respx.mock
    def test_gives_up_after_a_bounded_number_of_retries(self) -> None:
        route = respx.get(f"{BASE}/api/v1/transcriptions/job-1").mock(
            return_value=httpx.Response(429, headers={"retry-after": "1"}, json={})
        )

        with pytest.raises(ApiError) as caught:
            client().get_job("job-1")

        assert caught.value.status == 429
        assert route.call_count == 5  # the first attempt plus four retries


class TestWaitForJob:
    @respx.mock
    def test_polls_until_the_job_reaches_a_terminal_status(self) -> None:
        respx.get(f"{BASE}/api/v1/transcriptions/job-1").mock(
            side_effect=[
                httpx.Response(200, json={"id": "job-1", "status": "uploaded"}),
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

        job = client().wait_for_job("job-1", poll_interval=0.01)

        assert job["transcript"]["text"] == "hello"

    @respx.mock
    def test_raises_job_failed_with_the_code_that_says_what_to_do_next(self) -> None:
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

        with pytest.raises(JobFailedError) as caught:
            client().wait_for_job("job-1", poll_interval=0.01)

        # The request succeeded, so retrying it is pointless. The code is what
        # tells a caller to re-encode rather than to try again.
        assert caught.value.code == "invalid_audio"
        assert caught.value.job["id"] == "job-1"

    @respx.mock
    def test_a_cancelled_job_returns_rather_than_polling_forever(self) -> None:
        respx.get(f"{BASE}/api/v1/transcriptions/job-1").mock(
            return_value=httpx.Response(
                200, json={"id": "job-1", "status": "cancelled"}
            )
        )

        job = client().wait_for_job("job-1", poll_interval=0.01)

        assert job["status"] == "cancelled"


class TestReads:
    @respx.mock
    def test_list_models_reaches_through_the_extra_envelope_level(self) -> None:
        # The models payload nests one level deeper than the other list routes.
        respx.get(f"{BASE}/api/v1/models").mock(
            return_value=httpx.Response(
                200, json={"data": {"models": [{"id": "openai/whisper-large-v3"}]}}
            )
        )

        assert client().list_models()[0]["id"] == "openai/whisper-large-v3"

    @respx.mock
    def test_list_jobs_returns_an_empty_list_rather_than_none(self) -> None:
        respx.get(url__startswith=f"{BASE}/api/v1/transcriptions").mock(
            return_value=httpx.Response(200, json={})
        )

        assert client().list_jobs() == []


class TestConfiguration:
    @respx.mock
    def test_a_custom_base_url_loses_its_trailing_slashes(self) -> None:
        route = respx.get("https://staging.example.com/api/v1/models").mock(
            return_value=httpx.Response(200, json={"data": {"models": []}})
        )

        client(base_url="https://staging.example.com///").list_models()

        assert route.called

    @respx.mock
    def test_sends_the_bearer_token(self) -> None:
        route = respx.get(f"{BASE}/api/v1/models").mock(
            return_value=httpx.Response(200, json={"data": {"models": []}})
        )

        client().list_models()

        assert route.calls.last.request.headers["authorization"] == "Bearer ot_test"

    @respx.mock
    def test_does_not_follow_a_redirect_on_the_audio_upload(self, audio) -> None:
        """The one request whose BODY is worth protecting.

        Following redirects is right for the JSON calls, and the argument for it
        is that httpx strips Authorization cross-origin. That argument says
        nothing about the body, and this PUT never carried the key anyway. httpx
        resends the body on a 307/308, so following here would hand the user's
        audio to whatever `Location` points at. A signed upload URL has no
        legitimate reason to redirect a PUT, so this fails loudly instead.
        """
        upload_route()
        respx.put(UPLOAD_URL).mock(
            return_value=httpx.Response(
                307, headers={"location": "https://elsewhere.example.com/catch"}
            )
        )
        elsewhere = respx.put("https://elsewhere.example.com/catch").mock(
            return_value=httpx.Response(200)
        )
        create_route()

        with pytest.raises(ApiError) as caught:
            client().transcribe(audio, model="auto/best")

        assert caught.value.status == 307
        assert not elsewhere.called, "the audio was forwarded to the redirect target"

    @respx.mock
    def test_follows_a_redirect_like_the_typescript_client_does(self) -> None:
        """httpx does NOT follow redirects by default; `fetch` does.

        Leaving that at the httpx default would have been an accidental
        behavioural difference from the TypeScript SDK, and it fails in the
        least obvious way: a 3xx is not `is_success`, so the client raises
        ApiError on a response that is not an error at all. httpx strips the
        Authorization header on a cross-origin redirect itself
        (`BaseClient._redirect_headers`), so following costs no credential.
        """
        respx.get(f"{BASE}/api/v1/models").mock(
            return_value=httpx.Response(
                307, headers={"location": f"{BASE}/api/v1/models/"}
            )
        )
        respx.get(f"{BASE}/api/v1/models/").mock(
            return_value=httpx.Response(
                200, json={"data": {"models": [{"id": "openai/whisper-large-v3"}]}}
            )
        )

        assert client().list_models()[0]["id"] == "openai/whisper-large-v3"

    @respx.mock
    def test_closes_its_transport_when_used_as_a_context_manager(self) -> None:
        respx.get(f"{BASE}/api/v1/models").mock(
            return_value=httpx.Response(200, json={"data": {"models": []}})
        )

        with client() as open_client:
            open_client.list_models()

        assert open_client.is_closed
