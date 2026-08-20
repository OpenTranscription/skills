"""The guard that keeps this client honest as the API grows.

The TypeScript SDK gets this for free: `AssertNever<Unhandled>` fails to compile
the moment the spec grows a request field nobody mapped. Python has no such
thing, so without this test the two clients drift apart silently and the Python
one quietly stops being able to express half the API.

It reads the generated types rather than the live spec on purpose. That file is
committed, and CI's nightly `spec-drift` job already re-derives it from
https://opentranscription.io/openapi.json and fails on a diff. So this test is
offline and deterministic, and still cannot go stale by more than a day.
"""

from __future__ import annotations

import inspect
import re
from pathlib import Path

import pytest

from opentranscription import AsyncOpenTranscription, OpenTranscription
from opentranscription._core import DECLINED_FIELDS, IN_FLIGHT, TERMINAL

GENERATED = Path(__file__).resolve().parents[2] / "sdk" / "src" / "generated" / "api.ts"

# `transcribe` takes the audio itself; the rest of its parameters are API fields.
NOT_REQUEST_FIELDS = {"self", "file", "file_name"}


def spec_request_fields() -> set[str]:
    """Top-level properties of `CreateTranscriptionRequest`, per the generated types."""
    source = GENERATED.read_text(encoding="utf-8")

    block = re.search(
        r"^        CreateTranscriptionRequest: \{\n(.*?)^        \};$",
        source,
        re.DOTALL | re.MULTILINE,
    )
    assert block is not None, f"CreateTranscriptionRequest not found in {GENERATED}"

    # Exactly twelve spaces: a nested object's members are indented further and
    # are not fields of the request.
    #
    # Coverage boundary, so nobody reads more into this than it gives. If
    # openapi-typescript ever changes its indentation this returns an empty set
    # and `test_the_generated_types_are_actually_there` fails loudly, which is
    # the outcome we want. What it would MISS is a field name needing quotes in
    # TypeScript (a hyphenated JSON key renders as `"foo-bar"?: string;`): `\w+`
    # skips it, the remaining count stays above the guard, and it drops out
    # silently. No such field exists today, and one would be a breaking API
    # change, but this is the gap.
    return set(re.findall(r"^ {12}(\w+)\??[:?]", block.group(1), re.MULTILINE))


def signature_fields(method: object) -> set[str]:
    return set(inspect.signature(method).parameters) - NOT_REQUEST_FIELDS  # type: ignore[arg-type]


def test_the_generated_types_are_actually_there() -> None:
    # Without this, a moved or renamed file turns every assertion below into a
    # vacuous pass rather than a failure.
    assert GENERATED.is_file(), f"missing {GENERATED}"
    assert len(spec_request_fields()) > 5


def test_every_request_field_is_either_offered_or_explicitly_declined() -> None:
    unhandled = spec_request_fields() - signature_fields(OpenTranscription.transcribe)
    unhandled -= DECLINED_FIELDS

    assert not unhandled, (
        "The API grew request fields this client neither offers nor declines: "
        f"{sorted(unhandled)}. Add them to `transcribe` on BOTH clients, or to "
        "DECLINED_FIELDS with the reason."
    )


def test_the_client_does_not_offer_fields_the_api_does_not_have() -> None:
    invented = signature_fields(OpenTranscription.transcribe) - spec_request_fields()

    assert not invented, (
        f"`transcribe` offers {sorted(invented)}, which the API does not accept. "
        "A removed field must come off the signature, not be left to 400."
    )


def test_the_sync_and_async_signatures_have_not_drifted_apart() -> None:
    """The two signatures are written out twice so editors can complete them.

    This is the price of that: they are compared in full, every run.

    Comparing `inspect.Parameter` objects rather than a set of names, because a
    set of names is blind to every interesting kind of drift. Changing one
    client's `diarization: bool | NotGiven = NOT_GIVEN` to `bool = False`,
    or making a parameter keyword-only on one side, or swapping a default from
    NOT_GIVEN to None, all leave the NAMES identical while the behaviour
    diverges. `Parameter.__eq__` covers name, kind, default and annotation, and
    comparing lists rather than sets covers order too.
    """
    sync = list(inspect.signature(OpenTranscription.transcribe).parameters.values())
    api = list(inspect.signature(AsyncOpenTranscription.transcribe).parameters.values())

    assert sync == api, (
        "The sync and async `transcribe` signatures differ. Compare name, kind, "
        "default and annotation, not just the parameter list:\n"
        f"  sync only:  {[p for p in sync if p not in api]}\n"
        f"  async only: {[p for p in api if p not in sync]}"
    )


def spec_job_statuses() -> set[str]:
    """Members of the `JobStatus` union, from the generated types."""
    source = GENERATED.read_text(encoding="utf-8")

    line = re.search(r"^ {8}JobStatus: (.+);$", source, re.MULTILINE)
    assert line is not None, f"JobStatus not found in {GENERATED}"

    return set(re.findall(r'"([^"]+)"', line.group(1)))


def test_the_status_vocabulary_is_the_api_s_own() -> None:
    """`wait_for_job` decides when to stop from TERMINAL, so a made-up name hangs.

    This exists because a docstring here once said a new job "starts out
    queued". `queued` is AssemblyAI's provider-side status, not ours; the API
    writes `uploaded`. Nothing caught it, because the client tests mock their
    own server and will happily agree with whatever status the fixture invents.
    """
    statuses = spec_job_statuses()
    assert len(statuses) > 3, "JobStatus parsed to almost nothing; check the regex"

    invented = TERMINAL - statuses
    assert not invented, (
        f"TERMINAL names statuses the API cannot produce: {sorted(invented)}"
    )

    in_flight = IN_FLIGHT - statuses
    assert not in_flight, (
        f"IN_FLIGHT names statuses the API cannot produce: {sorted(in_flight)}"
    )


def test_every_real_status_is_classified() -> None:
    """The failure this actually prevents.

    A status the API adds and nobody classifies is treated as still-running by
    `is_terminal`, so `wait_for_job` polls a finished job until the caller kills
    it. Forcing every member of the union into one of the two sets turns that
    hang into a failed test.
    """
    unclassified = spec_job_statuses() - TERMINAL - IN_FLIGHT

    assert not unclassified, (
        f"The API grew statuses this client does not classify: "
        f"{sorted(unclassified)}. Put each in TERMINAL or IN_FLIGHT in _core.py "
        "— an unclassified one makes `wait_for_job` poll forever."
    )


@pytest.mark.parametrize("field", sorted(DECLINED_FIELDS))
def test_a_declined_field_is_one_the_api_really_has(field: str) -> None:
    # A field the API dropped should leave DECLINED_FIELDS too, or the set turns
    # into a graveyard that silently absorbs future names.
    assert field in spec_request_fields()
