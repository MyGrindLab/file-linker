from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from src.api.file import file_router
from src.core.exceptions import FileNotFound
from src.core.handlers import add_exception_handlers
from src.core.settings import settings
from src.domain.schemas.file import FileData
from src.infrastructure.database.mongo import get_db


class FakeFiles:
    def __init__(self) -> None:
        self.docs: list[dict[str, Any]] = []

    async def insert_one(self, doc: dict[str, Any]) -> None:
        self.docs.append(dict(doc))

    async def find_one(self, query: dict[str, Any]) -> dict[str, Any] | None:
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return doc
        return None


class FakeDB:
    def __init__(self) -> None:
        self.files = FakeFiles()


class FakeStorage:
    """Dict-backed stand-in for AsyncStorageClient (shared across instances)."""

    objects: dict[str, tuple[bytes, str]] = {}

    async def upload(self, filename: str, body: bytes, content_type: str) -> None:
        self.objects[filename] = (body, content_type)

    async def retrieve(self, filename: str) -> FileData:
        if filename not in self.objects:
            raise FileNotFound()
        body, content_type = self.objects[filename]
        return FileData(filename=filename, content=body, content_type=content_type)


@pytest.fixture
def db() -> FakeDB:
    return FakeDB()


@pytest.fixture
def storage(monkeypatch: pytest.MonkeyPatch) -> type[FakeStorage]:
    FakeStorage.objects = {}
    monkeypatch.setattr("src.domain.services.file.AsyncStorageClient", FakeStorage)
    return FakeStorage


@pytest.fixture
async def client(
    db: FakeDB, storage: type[FakeStorage], monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[httpx.AsyncClient]:
    monkeypatch.setattr(settings, "DEBUG", True)
    app = FastAPI()
    app.include_router(file_router, prefix="/api")
    add_exception_handlers(app)
    app.dependency_overrides[get_db] = lambda: db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
