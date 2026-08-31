"""Pure helpers, tested without a network so the client tests can stay about I/O."""

from __future__ import annotations

import httpx
import pytest

from opentranscription import NOT_GIVEN, ApiError, OpenTranscriptionError
from opentranscription._core import (
    IN_FLIGHT,
    TERMINAL,
    build_request,
    content_type_for,
    is_terminal,
    resolve_file,
    retry_after_seconds,
    success_body,
)


class TestContentType:
    @pytest.mark.parametrize(
        ("name", "expected"),
        [
            ("interview.mp3", "audio/mpeg"),
            ("interview.MP3", "audio/mpeg"),
            ("call.m4a", "audio/mp4"),
            ("take.wav", "audio/wav"),
            ("master.flac", "audio/flac"),
            ("voice.opus", "audio/opus"),
        ],
    )
    def test_maps_known_audio_extensions(self, name: str, expected: str) -> None:
        assert content_type_for(name) == expected

    def test_falls_back_rather_than_guessing(self) -> None:
        assert content_type_for("notes") == "application/octet-stream"
        assert content_type_for("archive.zip") == "application/octet-stream"


class TestResolveFile:
    def test_reads_a_path_and_takes_its_name(self, tmp_path) -> None:
        audio = tmp_path / "interview.mp3"
        audio.write_bytes(b"ID3 fake")

        data, name = resolve_file(audio, None)

        assert data == b"ID3 fake"
        assert name == "interview.mp3"

    def test_accepts_a_string_path(self, tmp_path) -> None:
        audio = tmp_path / "call.wav"
        audio.write_bytes(b"RIFF")

        assert resolve_file(str(audio), None) == (b"RIFF", "call.wav")

    def test_an_explicit_name_wins_over_the_path(self, tmp_path) -> None:
        audio = tmp_path / "tmp1234.mp3"
        audio.write_bytes(b"x")

        assert resolve_file(audio, "interview.mp3")[1] == "interview.mp3"

    def test_reads_a_file_object(self, tmp_path) -> None:
        audio = tmp_path / "meeting.mp3"
        audio.write_bytes(b"bytes here")

        with audio.open("rb") as handle:
            assert resolve_file(handle, None) == (b"bytes here", "meeting.mp3")

    def test_raw_bytes_need_a_name(self) -> None:
        assert resolve_file(b"raw", "clip.mp3") == (b"raw", "clip.mp3")

        # The name decides the Content-Type and the upload's declared filename.
        # Inventing one would silently send audio/octet-stream.
        with pytest.raises(ValueError, match="file_name"):
            resolve_file(b"raw", None)


class TestBuildRequest:
    def test_omits_what_the_caller_never_passed(self) -> None:
        request = build_request(
            "org/file.mp3", {"model": "auto/best", "language": NOT_GIVEN}
        )

        assert request == {"file_path": "org/file.mp3", "model": "auto/best"}

    def test_keeps_false_because_the_api_reads_it(self) -> None:
        # `diarization: false` forces diarization OFF on a model that would
        # otherwise turn it on. Dropping it applies the opposite policy.
        request = build_request("org/file.mp3", {"diarization": False})

        assert request["diarization"] is False

    def test_keeps_none_because_the_api_reads_it_too(self) -> None:
        # `audio_retention_days: null` means retain indefinitely. This is why
        # NOT_GIVEN exists at all: None cannot double as "absent".
        request = build_request("org/file.mp3", {"audio_retention_days": None})

        assert "audio_retention_days" in request
        assert request["audio_retention_days"] is None

    def test_file_path_comes_from_the_server_not_the_caller(self) -> None:
        request = build_request("org/real.mp3", {"file_path": "../someone-else.mp3"})

        assert request["file_path"] == "org/real.mp3"


class TestRetryAfter:
    def test_prefers_retry_after_seconds(self) -> None:
        assert (
            retry_after_seconds({"retry-after": "7"}, now=1000.0, fallback=2.0) == 7.0
        )

    def test_falls_back_to_the_rate_limit_reset_epoch(self) -> None:
        headers = {"x-ratelimit-reset": "1030"}

        assert retry_after_seconds(headers, now=1000.0, fallback=2.0) == 30.0

    def test_caps_an_absurd_reset_rather_than_sleeping_for_an_hour(self) -> None:
        headers = {"x-ratelimit-reset": "99999"}

        assert retry_after_seconds(headers, now=1000.0, fallback=2.0) == 60.0

    def test_uses_the_fallback_when_the_headers_are_junk_or_absent(self) -> None:
        assert retry_after_seconds({}, now=1000.0, fallback=2.0) == 2.0
        assert retry_after_seconds({"retry-after": "soon"}, 1000.0, 2.0) == 2.0
        # A reset already in the past must not produce a negative sleep.
        assert retry_after_seconds({"x-ratelimit-reset": "10"}, 1000.0, 2.0) == 2.0


class TestTerminal:
    def test_recognises_every_status_the_api_will_not_move_away_from(self) -> None:
        assert is_terminal("completed")
        assert is_terminal("failed")
        assert is_terminal("cancelled")

    def test_leaves_in_flight_statuses_alone(self) -> None:
        # Driven off IN_FLIGHT rather than a hand-typed list, so this cannot
        # quietly go on testing a status the API does not emit.
        for status in IN_FLIGHT:
            assert not is_terminal(status)

    def test_the_two_sets_do_not_overlap(self) -> None:
        assert not (TERMINAL & IN_FLIGHT)


class TestSuccessBody:
    def test_returns_the_decoded_object(self) -> None:
        response = httpx.Response(200, json={"data": {"models": []}})

        assert success_body(response) == {"data": {"models": []}}

    def test_a_non_object_body_reads_as_empty(self) -> None:
        # The clients only ever `.get` on the result, so a bare list or scalar
        # is treated the way it always was, not as an error.
        assert success_body(httpx.Response(200, json=[1, 2])) == {}

    def test_a_non_json_body_is_an_api_error_that_names_the_cause(self) -> None:
        # The #5220 shape: a locale-prefixed base_url serves the website's HTML
        # with a 200, and `response.json()` used to leak a JSONDecodeError.
        request = httpx.Request("GET", "https://opentranscription.io/en/api/v1/models")
        response = httpx.Response(
            200,
            headers={"content-type": "text/html; charset=utf-8"},
            text="<!doctype html><html></html>",
            request=request,
        )

        with pytest.raises(ApiError) as caught:
            success_body(response)

        assert isinstance(caught.value, OpenTranscriptionError)
        assert caught.value.status == 200
        assert caught.value.code is None
        message = str(caught.value)
        assert "text/html; charset=utf-8" in message
        assert "HTTP 200" in message
        assert "https://opentranscription.io/en/api/v1/models" in message
        assert "base_url" in message

    def test_a_missing_content_type_is_still_a_clear_error(self) -> None:
        request = httpx.Request("GET", "https://opentranscription.io/api/v1/models")
        response = httpx.Response(200, content=b"not json", request=request)

        with pytest.raises(ApiError) as caught:
            success_body(response)

        assert "no content-type" in str(caught.value)
        assert caught.value.status == 200
