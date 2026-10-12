import uuid

import httpx
import pytest
from tests.conftest import FakeDB, FakeStorage

from src.domain.services.file import FileService
from src.domain.services.password import crypt_password

PAYLOAD = b"<script>alert(document.domain)</script>"


async def _upload(client: httpx.AsyncClient, name: str, body: bytes, mime: str) -> str:
    resp = await client.post("/api/file/upload/", files={"file": (name, body, mime)})
    assert resp.status_code == 200, resp.text
    return str(resp.json()["value"]).rsplit("/view/", 1)[1]


def _assert_hardened(resp: httpx.Response) -> None:
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in resp.headers["content-security-policy"]


async def test_html_upload_is_served_as_inline_text_plain_with_security_headers(
    client: httpx.AsyncClient, storage: type[FakeStorage]
) -> None:
    short_id = await _upload(client, "x.html", PAYLOAD, "text/html")

    resp = await client.get(f"/api/file/{short_id}/")

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/plain")
    _assert_hardened(resp)
    assert resp.headers["content-disposition"].startswith("inline")
    assert "filename*=UTF-8''x.html" in resp.headers["content-disposition"]
    assert resp.content == PAYLOAD
    stored = [ct for _, ct in storage.objects.values()]
    assert stored
    assert all(ct != "text/html" for ct in stored)


async def test_xml_upload_is_served_as_inline_text_plain_with_security_headers(
    client: httpx.AsyncClient, storage: type[FakeStorage]
) -> None:
    body = b"<?xml version='1.0'?><x:script xmlns:x='http://www.w3.org/1999/xhtml'/>"
    short_id = await _upload(client, "x.xml", body, "application/xml")

    resp = await client.get(f"/api/file/{short_id}/")

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/plain")
    _assert_hardened(resp)
    assert resp.headers["content-disposition"].startswith("inline")
    assert "filename*=UTF-8''x.xml" in resp.headers["content-disposition"]
    assert resp.content == body
    stored = [ct for _, ct in storage.objects.values()]
    assert stored
    assert all("xml" not in ct and ct != "text/html" for ct in stored)


async def test_legacy_html_object_stored_as_text_html_is_still_served_as_text_plain(
    client: httpx.AsyncClient, db: FakeDB, storage: type[FakeStorage]
) -> None:
    key = f"{uuid.uuid4()}.html"
    await db.files.insert_one(
        {"filename": key, "short_id": "legacy1", "original_filename": "old.html"}
    )
    storage.objects[key] = (PAYLOAD, "text/html")

    resp = await client.get("/api/file/legacy1/")

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/plain")
    _assert_hardened(resp)
    assert resp.content == PAYLOAD


@pytest.mark.parametrize(
    ("name", "mime", "expected"),
    [
        ("a.png", "image/png", "image/png"),
        ("a.pdf", "application/pdf", "application/pdf"),
    ],
)
async def test_png_and_pdf_keep_their_type_with_security_headers(
    client: httpx.AsyncClient, name: str, mime: str, expected: str
) -> None:
    short_id = await _upload(client, name, b"data", mime)

    resp = await client.get(f"/api/file/{short_id}/")

    assert resp.status_code == 200
    assert resp.headers["content-type"] == expected
    _assert_hardened(resp)


async def test_unknown_extension_fallback_is_octet_stream_attachment(
    client: httpx.AsyncClient, storage: type[FakeStorage]
) -> None:
    storage.objects["abc.svg"] = (b"<svg onload=alert(1)/>", "image/svg+xml")

    resp = await client.get("/api/file/abc.svg/")

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/octet-stream"
    assert resp.headers["content-disposition"].startswith("attachment")
    _assert_hardened(resp)


async def test_password_protected_file_without_header_returns_423(
    client: httpx.AsyncClient, db: FakeDB, storage: type[FakeStorage]
) -> None:
    key = f"{uuid.uuid4()}.txt"
    await db.files.insert_one(
        {
            "filename": key,
            "short_id": "locked1",
            "original_filename": "s.txt",
            "password_hash": crypt_password("secret123"),
        }
    )
    storage.objects[key] = (b"secret", "text/plain; charset=utf-8")

    resp = await client.get("/api/file/locked1/")

    assert resp.status_code == 423


TEXT = "text/plain; charset=utf-8"


@pytest.mark.parametrize(
    ("ext", "expected"),
    [
        ("png", ("image/png", False)),
        ("jpg", ("image/jpeg", False)),
        ("jpeg", ("image/jpeg", False)),
        ("gif", ("image/gif", False)),
        ("webp", ("image/webp", False)),
        ("mp4", ("video/mp4", False)),
        ("webm", ("video/webm", False)),
        ("ogg", ("video/ogg", False)),
        ("mov", ("video/quicktime", False)),
        ("pdf", ("application/pdf", False)),
        ("html", (TEXT, False)),
        ("xml", (TEXT, False)),
        ("txt", (TEXT, False)),
        ("log", (TEXT, False)),
        ("csv", (TEXT, False)),
        ("json", (TEXT, False)),
        ("HTML", (TEXT, False)),
        (".PNG", ("image/png", False)),
        (".html", (TEXT, False)),
        ("svg", ("application/octet-stream", True)),
        ("", ("application/octet-stream", True)),
    ],
)
def test_safe_content_type_mapping(ext: str, expected: tuple[str, bool]) -> None:
    assert FileService.safe_content_type(ext) == expected
