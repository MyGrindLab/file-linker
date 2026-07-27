"""Regression tests for the pre-existing upload/retrieve paths."""

import pytest
from httpx import AsyncClient

from tests.conftest import AuthedClient

from src.core.exceptions import FileNotFound
from src.core.settings import settings


async def test_anonymous_upload_succeeds_and_returns_view_link(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/file/upload/",
        files={"file": ("sample.txt", b"hello world", "text/plain")},
    )

    assert response.status_code == 200, response.text
    link = response.json()["value"]
    assert link.startswith(f"{settings.DOMAIN}/view/")
    short_id = link.rsplit("/", 1)[-1]
    assert short_id


async def test_upload_disallowed_extension_returns_400(client: AsyncClient) -> None:
    response = await client.post(
        "/api/file/upload/",
        files={"file": ("malware.exe", b"binary", "application/octet-stream")},
    )

    assert response.status_code == 400


async def test_upload_oversized_returns_413(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ANON_MAX_SIZE_BYTES", 5)

    response = await client.post(
        "/api/file/upload/",
        files={"file": ("big.txt", b"too many bytes", "text/plain")},
    )

    assert response.status_code == 413


async def test_upload_with_password_while_anonymous_returns_401(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/file/upload/",
        files={"file": ("secret.txt", b"content", "text/plain")},
        data={"password": "abcd1234"},
    )

    assert response.status_code == 401


async def test_authenticated_upload_with_password_sets_has_password(
    client_a: AuthedClient,
) -> None:
    upload_response = await client_a.client.post(
        "/api/file/upload/",
        files={"file": ("secret.txt", b"content", "text/plain")},
        data={"password": "abcd1234"},
    )
    assert upload_response.status_code == 200, upload_response.text
    short_id = upload_response.json()["value"].rsplit("/", 1)[-1]

    list_response = await client_a.client.get("/api/file/my/")
    item = next(
        i for i in list_response.json()["items"] if i["short_id"] == short_id
    )
    assert item["has_password"] is True


async def test_retrieve_returns_bytes_content_type_and_disposition(
    client: AsyncClient,
) -> None:
    upload_response = await client.post(
        "/api/file/upload/",
        files={"file": ("sample.txt", b"hello world", "text/plain")},
    )
    short_id = upload_response.json()["value"].rsplit("/", 1)[-1]

    response = await client.get(f"/api/file/{short_id}/")

    assert response.status_code == 200
    assert response.content == b"hello world"
    assert response.headers["content-type"].startswith("text/plain")
    assert (
        response.headers["content-disposition"]
        == "inline; filename*=UTF-8''sample.txt"
    )


async def test_retrieve_unknown_short_id_pinned_behaviour(
    client: AsyncClient,
) -> None:
    """Pins the ACTUAL current behaviour (not the desired one).

    `FileService.retrieve` falls back to treating the short_id itself as the
    S3 storage key when no Mongo record matches. `AsyncStorageClient.retrieve`
    then raises `FileNotFound`, a plain `Exception` (not a `BaseHTTPException`),
    which is not mapped to a 404 anywhere. It is only caught by the catch-all
    `@app.exception_handler(Exception)` in `core/handlers.py`, which builds
    and sends a 500 response but then Starlette's `ServerErrorMiddleware`
    re-raises the original exception afterwards. Because this in-process test
    harness uses `httpx.ASGITransport(raise_app_exceptions=True)` (the
    default), that re-raise surfaces here as a raised `FileNotFound` rather
    than a `Response` object. Against a real running server (uvicorn), a
    caller would observe this as a bare HTTP 500 (a raw traceback body in
    DEBUG mode, or `{"error": "Unexpected error"}` otherwise) -- not a 404.
    """
    with pytest.raises(FileNotFound):
        await client.get("/api/file/does-not-exist/")
