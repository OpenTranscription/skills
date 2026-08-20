"""Python client for the OpenTranscription API.

    from opentranscription import OpenTranscription

    ot = OpenTranscription(api_key="ot_...")
    job = ot.transcribe("interview.mp3", model="auto/best")
    print(ot.wait_for_job(job["id"])["transcript"]["text"])

Docs: https://opentranscription.io/docs
"""

from ._async_client import AsyncOpenTranscription
from ._client import OpenTranscription
from ._core import NOT_GIVEN, CatalogModel, FileInput, Job, NotGiven
from ._errors import ApiError, JobFailedError, OpenTranscriptionError

__all__ = [
    "NOT_GIVEN",
    "ApiError",
    "AsyncOpenTranscription",
    "CatalogModel",
    "FileInput",
    "Job",
    "JobFailedError",
    "NotGiven",
    "OpenTranscription",
    "OpenTranscriptionError",
]
