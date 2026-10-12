"""Shared fixtures for the file-management test suite.

Notable design choices (see backend CLAUDE.md / task brief for rationale):
- The ASGI app is exercised via ``httpx.AsyncClient`` + ``ASGITransport``,
  which never runs the app's ``lifespan``. No real Mongo/Redis/S3 connection
  is ever attempted.
- ``get_db`` is overridden with a fresh ``mongomock_motor`` database per test.
- ``AsyncStorageClient`` is monkeypatched where it is *constructed*
  (``src.domain.services.file``), not where it is defined, because
  ``FileService.__init__`` builds its own instance.
- ``DEBUG=true`` is set before any application module is imported so that
  ``_set_rate_limit`` short-circuits and Redis is never touched.
"""

import os
from collections.abc import AsyncIterator, Awaitable, Callable, Generator
from dataclasses import dataclass
from pathlib import Path

os.environ["DEBUG"] = "true"

# The app mounts StaticFiles(directory="static") using a path relative to
# the process working directory (mirrors the container's WORKDIR=/app).
# Without this chdir, importing `main` below would fail at collection time.
os.chdir(Path(__file__).resolve().parent.parent / "app")

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorDatabase  # noqa: E402

from main import app  # noqa: E402

import src.domain.services.file as file_service_module  # noqa: E402
from src.core.exceptions import FileNotFound  # noqa: E402
from src.core.security import create_access_token  # noqa: E402
from src.domain.schemas.file import FileData  # noqa: E402
from src.infrastructure.database.mongo import get_db  # noqa: E402


class FakeStorageClient:
    """In-memory stand-in for AsyncStorageClient, keyed by S3 object key."""

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    async def upload(
        self,
        filename: str,
        body: bytes,
        content_type: str = "application/octet-stream",
        bucket: str | None = None,
    ) -> str:
        self.objects[filename] = (body, content_type)
        return filename

    async def retrieve(self, filename: str, bucket: str | None = None) -> FileData:
        if filename not in self.objects:
            raise FileNotFound
        content, content_type = self.objects[filename]
        return FileData(filename=filename, content=content, content_type=content_type)

    async def delete(self, filename: str, bucket: str | None = None) -> None:
        if filename not in self.objects:
            raise FileNotFound
        del self.objects[filename]


@pytest.fixture
def fake_storage(monkeypatch: pytest.MonkeyPatch) -> FakeStorageClient:
    storage = FakeStorageClient()
    # FileService.__init__ does `self._storage = AsyncStorageClient()`, so we
    # must patch the name as looked up inside the service module.
    monkeypatch.setattr(file_service_module, "AsyncStorageClient", lambda: storage)
    return storage


@pytest.fixture
def db() -> Generator[AsyncIOMotorDatabase]:  # type: ignore[type-arg]
    mongo_client: AsyncMongoMockClient = AsyncMongoMockClient()
    database = mongo_client["file_linker_test"]
    app.dependency_overrides[get_db] = lambda: database
    yield database
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
async def client(
    db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
    fake_storage: FakeStorageClient,
) -> AsyncIterator[AsyncClient]:
    """Unauthenticated client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@dataclass
class AuthedClient:
    client: AsyncClient
    user_id: str


async def _create_user(
    db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
    *,
    email: str,
    is_paid: bool,
) -> tuple[str, str]:
    result = await db.users.insert_one(
        {
            "email": email,
            "password": None,
            "oauth_provider": None,
            "oauth_id": None,
            "is_paid": is_paid,
            "stripe_customer_id": None,
        }
    )
    user_id = str(result.inserted_id)
    token = create_access_token(user_id, is_paid)
    return user_id, token


@pytest.fixture
async def authed_client_factory(
    db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
    fake_storage: FakeStorageClient,
) -> AsyncIterator[Callable[..., Awaitable[AuthedClient]]]:
    transport = ASGITransport(app=app)
    clients: list[AsyncClient] = []

    async def _make(email: str, is_paid: bool = False) -> AuthedClient:
        user_id, token = await _create_user(db, email=email, is_paid=is_paid)
        ac = AsyncClient(
            transport=transport,
            base_url="http://test",
            headers={"Authorization": f"Bearer {token}"},
        )
        clients.append(ac)
        return AuthedClient(client=ac, user_id=user_id)

    yield _make

    for ac in clients:
        await ac.aclose()


@pytest.fixture
async def client_a(
    authed_client_factory: Callable[..., Awaitable[AuthedClient]],
) -> AuthedClient:
    return await authed_client_factory("user-a@example.com")


@pytest.fixture
async def client_b(
    authed_client_factory: Callable[..., Awaitable[AuthedClient]],
) -> AuthedClient:
    return await authed_client_factory("user-b@example.com")


@pytest.fixture
async def client_a_paid(
    authed_client_factory: Callable[..., Awaitable[AuthedClient]],
) -> AuthedClient:
    return await authed_client_factory("user-a-paid@example.com", is_paid=True)


async def _upload(
    client: AsyncClient,
    *,
    filename: str = "test.txt",
    content: bytes = b"hello world",
    content_type: str = "text/plain",
    password: str | None = None,
) -> str:
    files = {"file": (filename, content, content_type)}
    data = {"password": password} if password is not None else {}
    response = await client.post("/api/file/upload/", files=files, data=data)
    response.raise_for_status()
    link: str = response.json()["value"]
    return link.rsplit("/", 1)[-1]


@pytest.fixture
def upload_file() -> Callable[..., Awaitable[str]]:
    """Upload a file through the given client, return its short_id."""
    return _upload
