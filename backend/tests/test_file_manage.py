"""Tests for the KAN-1 file-management endpoints: list, replace content,
password management, and soft-delete."""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from tests.conftest import AuthedClient, FakeStorageClient

from src.core.settings import settings

UploadFn = Callable[..., Awaitable[str]]

ROUTES = ["replace_content", "set_password", "remove_password", "delete_file"]


async def _hit_route(client: AsyncClient, route: str, short_id: str) -> Response:
    if route == "replace_content":
        files = {"file": ("new.txt", b"new content", "text/plain")}
        return await client.put(f"/api/file/{short_id}/content/", files=files)
    if route == "set_password":
        return await client.put(
            f"/api/file/{short_id}/password/", json={"password": "abcd"}
        )
    if route == "remove_password":
        return await client.delete(f"/api/file/{short_id}/password/")
    if route == "delete_file":
        return await client.delete(f"/api/file/{short_id}/")
    raise ValueError(f"Unknown route {route}")


# --------------------------------------------------------------------------
# List
# --------------------------------------------------------------------------


async def test_list_returns_only_own_files(
    client_a: AuthedClient, client_b: AuthedClient, upload_file: UploadFn
) -> None:
    short_a = await upload_file(client_a.client)
    await upload_file(client_b.client)

    response = await client_a.client.get("/api/file/my/")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert [item["short_id"] for item in body["items"]] == [short_a]


async def test_list_orders_newest_first(
    client_a: AuthedClient,
    upload_file: UploadFn,
    db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
) -> None:
    oldest = await upload_file(client_a.client, filename="oldest.txt")
    middle = await upload_file(client_a.client, filename="middle.txt")
    newest = await upload_file(client_a.client, filename="newest.txt")

    now = datetime.now(UTC)
    await db.files.update_one(
        {"short_id": oldest}, {"$set": {"uploaded_at": now - timedelta(hours=2)}}
    )
    await db.files.update_one(
        {"short_id": middle}, {"$set": {"uploaded_at": now - timedelta(hours=1)}}
    )
    await db.files.update_one({"short_id": newest}, {"$set": {"uploaded_at": now}})

    response = await client_a.client.get("/api/file/my/")

    assert response.status_code == 200
    short_ids = [item["short_id"] for item in response.json()["items"]]
    assert short_ids == [newest, middle, oldest]


async def test_list_pagination_limit_offset_and_total(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    for i in range(5):
        await upload_file(client_a.client, filename=f"file-{i}.txt")

    first_page = await client_a.client.get("/api/file/my/?limit=2&offset=0")
    second_page = await client_a.client.get("/api/file/my/?limit=2&offset=2")

    assert first_page.status_code == 200
    assert second_page.status_code == 200
    assert len(first_page.json()["items"]) == 2
    assert len(second_page.json()["items"]) == 2
    assert first_page.json()["total"] == 5
    assert second_page.json()["total"] == 5

    first_ids = {item["short_id"] for item in first_page.json()["items"]}
    second_ids = {item["short_id"] for item in second_page.json()["items"]}
    assert first_ids.isdisjoint(second_ids)


async def test_list_excludes_soft_deleted_files(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    kept = await upload_file(client_a.client, filename="kept.txt")
    deleted = await upload_file(client_a.client, filename="deleted.txt")

    delete_response = await client_a.client.delete(f"/api/file/{deleted}/")
    assert delete_response.status_code == 204

    response = await client_a.client.get("/api/file/my/")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert [item["short_id"] for item in body["items"]] == [kept]


async def test_list_reports_has_password_and_hides_password_hash(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    protected = await upload_file(
        client_a.client, filename="secret.txt", password="pass1234"
    )
    plain = await upload_file(client_a.client, filename="plain.txt")

    response = await client_a.client.get("/api/file/my/")

    assert response.status_code == 200
    assert "password_hash" not in response.text

    by_id = {item["short_id"]: item for item in response.json()["items"]}
    assert by_id[protected]["has_password"] is True
    assert by_id[plain]["has_password"] is False


async def test_list_includes_legacy_record_without_is_active_field(
    client_a: AuthedClient, db: AsyncIOMotorDatabase  # type: ignore[type-arg]
) -> None:
    await db.files.insert_one(
        {
            "filename": "legacy-uuid.txt",
            "short_id": "legacyShortId1",
            "original_filename": "legacy.txt",
            "user_id": client_a.user_id,
            "size_bytes": 42,
            "password_hash": None,
            "expires_at": None,
            "uploaded_at": datetime.now(UTC),
            # deliberately no "is_active" key, simulating a pre-existing doc
        }
    )

    response = await client_a.client.get("/api/file/my/")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["short_id"] == "legacyShortId1"
    assert body["items"][0]["is_active"] is True


async def test_list_requires_auth_401(client: AsyncClient) -> None:
    response = await client.get("/api/file/my/")
    assert response.status_code == 401


# --------------------------------------------------------------------------
# Route ordering
# --------------------------------------------------------------------------


async def test_my_route_not_captured_by_short_id_route(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    await upload_file(client_a.client)

    response = await client_a.client.get("/api/file/my/")

    assert response.status_code == 200
    body = response.json()
    assert "items" in body and "total" in body
    assert "Content-Disposition" not in response.headers


# --------------------------------------------------------------------------
# Replace content
# --------------------------------------------------------------------------


async def test_replace_content_keeps_short_id_and_link_unchanged(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client, filename="original.txt")
    before = (await client_a.client.get("/api/file/my/")).json()["items"][0]

    response = await client_a.client.put(
        f"/api/file/{short_id}/content/",
        files={"file": ("replacement.txt", b"new content", "text/plain")},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["short_id"] == short_id
    assert body["link"] == before["link"]


async def test_replace_content_updates_filename_and_size(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(
        client_a.client, filename="original.txt", content=b"12345"
    )

    response = await client_a.client.put(
        f"/api/file/{short_id}/content/",
        files={"file": ("renamed.txt", b"a longer body", "text/plain")},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["original_filename"] == "renamed.txt"
    assert body["size_bytes"] == len(b"a longer body")


async def test_replace_content_preserves_expires_at_and_password(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(
        client_a.client, filename="original.txt", password="secret1"
    )
    before = (await client_a.client.get("/api/file/my/")).json()["items"][0]
    assert before["expires_at"] is not None

    response = await client_a.client.put(
        f"/api/file/{short_id}/content/",
        files={"file": ("new.txt", b"new content", "text/plain")},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["expires_at"] == before["expires_at"]
    assert body["has_password"] is True


async def test_replace_content_different_extension_swaps_s3_keys(
    client_a: AuthedClient,
    upload_file: UploadFn,
    fake_storage: FakeStorageClient,
    db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
) -> None:
    short_id = await upload_file(
        client_a.client, filename="original.txt", content=b"old bytes"
    )
    old_record = await db.files.find_one({"short_id": short_id})
    old_key = old_record["filename"]
    assert old_key in fake_storage.objects

    response = await client_a.client.put(
        f"/api/file/{short_id}/content/",
        files={"file": ("new.png", b"\x89PNG new bytes", "image/png")},
    )
    assert response.status_code == 200, response.text

    new_record = await db.files.find_one({"short_id": short_id})
    new_key = new_record["filename"]

    assert new_key != old_key
    assert new_key in fake_storage.objects
    assert old_key not in fake_storage.objects

    get_response = await client_a.client.get(f"/api/file/{short_id}/")
    assert get_response.status_code == 200
    assert get_response.content == b"\x89PNG new bytes"


async def test_replace_content_same_extension_overwrites_in_place(
    client_a: AuthedClient,
    upload_file: UploadFn,
    fake_storage: FakeStorageClient,
    db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
) -> None:
    """Regression test: when the new extension matches the old one, the S3
    key is identical, so an unguarded "delete the old object" would erase
    what was just written."""
    short_id = await upload_file(
        client_a.client, filename="original.txt", content=b"version-1"
    )
    old_record = await db.files.find_one({"short_id": short_id})
    old_key = old_record["filename"]

    response = await client_a.client.put(
        f"/api/file/{short_id}/content/",
        files={"file": ("replacement.txt", b"version-2", "text/plain")},
    )
    assert response.status_code == 200, response.text

    new_record = await db.files.find_one({"short_id": short_id})
    assert new_record["filename"] == old_key
    assert old_key in fake_storage.objects
    assert fake_storage.objects[old_key][0] == b"version-2"

    get_response = await client_a.client.get(f"/api/file/{short_id}/")
    assert get_response.status_code == 200
    assert get_response.content == b"version-2"


async def test_replace_content_oversized_returns_413(
    client_a: AuthedClient, upload_file: UploadFn, monkeypatch: pytest.MonkeyPatch
) -> None:
    short_id = await upload_file(client_a.client, filename="original.txt")
    monkeypatch.setattr(settings, "REGISTERED_MAX_SIZE_BYTES", 5)

    response = await client_a.client.put(
        f"/api/file/{short_id}/content/",
        files={"file": ("big.txt", b"too many bytes", "text/plain")},
    )

    assert response.status_code == 413


async def test_replace_content_disallowed_extension_returns_400(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client, filename="original.txt")

    response = await client_a.client.put(
        f"/api/file/{short_id}/content/",
        files={"file": ("malware.exe", b"binary", "application/octet-stream")},
    )

    assert response.status_code == 400


# --------------------------------------------------------------------------
# Password
# --------------------------------------------------------------------------


async def test_set_password_on_unprotected_file_then_requires_header(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client, content=b"protected content")

    set_response = await client_a.client.put(
        f"/api/file/{short_id}/password/", json={"password": "abcd"}
    )
    assert set_response.status_code == 204

    no_header = await client_a.client.get(f"/api/file/{short_id}/")
    assert no_header.status_code == 423

    correct = await client_a.client.get(
        f"/api/file/{short_id}/", headers={"X-File-Password": "abcd"}
    )
    assert correct.status_code == 200
    assert correct.content == b"protected content"

    wrong = await client_a.client.get(
        f"/api/file/{short_id}/", headers={"X-File-Password": "wrong"}
    )
    assert wrong.status_code == 403


async def test_update_existing_password_old_stops_new_works(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client, password="first123")

    update_response = await client_a.client.put(
        f"/api/file/{short_id}/password/", json={"password": "second456"}
    )
    assert update_response.status_code == 204

    old_password = await client_a.client.get(
        f"/api/file/{short_id}/", headers={"X-File-Password": "first123"}
    )
    assert old_password.status_code == 403

    new_password = await client_a.client.get(
        f"/api/file/{short_id}/", headers={"X-File-Password": "second456"}
    )
    assert new_password.status_code == 200


async def test_delete_password_makes_file_public_again(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client, password="secret12")

    remove_response = await client_a.client.delete(f"/api/file/{short_id}/password/")
    assert remove_response.status_code == 204

    response = await client_a.client.get(f"/api/file/{short_id}/")
    assert response.status_code == 200


async def test_set_password_too_short_returns_422(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client)

    response = await client_a.client.put(
        f"/api/file/{short_id}/password/", json={"password": "ab"}
    )

    assert response.status_code == 422


# --------------------------------------------------------------------------
# Delete
# --------------------------------------------------------------------------


async def test_delete_file_returns_204_removes_s3_soft_deletes_mongo(
    client_a: AuthedClient,
    upload_file: UploadFn,
    fake_storage: FakeStorageClient,
    db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
) -> None:
    short_id = await upload_file(client_a.client)
    record = await db.files.find_one({"short_id": short_id})
    key = record["filename"]
    assert key in fake_storage.objects

    response = await client_a.client.delete(f"/api/file/{short_id}/")

    assert response.status_code == 204
    assert key not in fake_storage.objects

    updated = await db.files.find_one({"short_id": short_id})
    assert updated is not None
    assert updated["is_active"] is False
    assert updated["deactivated_at"] is not None


async def test_get_deleted_file_returns_410_with_error_body(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client)
    await client_a.client.delete(f"/api/file/{short_id}/")

    response = await client_a.client.get(f"/api/file/{short_id}/")

    assert response.status_code == 410
    body = response.json()
    assert "error" in body
    assert "detail" not in body


async def test_deleted_file_excluded_from_list(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client)
    await client_a.client.delete(f"/api/file/{short_id}/")

    response = await client_a.client.get("/api/file/my/")

    assert response.status_code == 200
    assert response.json()["total"] == 0


async def test_delete_already_deleted_file_returns_404(
    client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client)
    first = await client_a.client.delete(f"/api/file/{short_id}/")
    assert first.status_code == 204

    second = await client_a.client.delete(f"/api/file/{short_id}/")

    assert second.status_code == 404


# --------------------------------------------------------------------------
# Ownership / auth, parametrized across all mutating routes
# --------------------------------------------------------------------------


@pytest.mark.parametrize("route", ROUTES)
async def test_other_users_file_returns_404_never_403(
    route: str, client_a: AuthedClient, client_b: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client)

    response = await _hit_route(client_b.client, route, short_id)

    assert response.status_code == 404


@pytest.mark.parametrize("route", ROUTES)
async def test_unknown_short_id_returns_404(
    route: str, client_a: AuthedClient
) -> None:
    response = await _hit_route(client_a.client, route, "doesNotExist0000")

    assert response.status_code == 404


@pytest.mark.parametrize("route", ROUTES)
async def test_anonymous_files_return_404_for_any_authenticated_user(
    route: str, client: AsyncClient, client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client)  # anonymous upload -> user_id is None

    response = await _hit_route(client_a.client, route, short_id)

    assert response.status_code == 404


@pytest.mark.parametrize("route", ROUTES)
async def test_no_token_returns_401(
    route: str, client: AsyncClient, client_a: AuthedClient, upload_file: UploadFn
) -> None:
    short_id = await upload_file(client_a.client)

    response = await _hit_route(client, route, short_id)

    assert response.status_code == 401
