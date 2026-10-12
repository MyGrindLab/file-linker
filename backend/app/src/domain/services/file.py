import uuid as uuid_lib
from datetime import UTC, datetime, timedelta

from fastapi import UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.core.exceptions import (
    BadRequest,
    FileTooLarge,
    Forbidden,
    Locked,
    Unauthorized,
)
from src.core.settings import settings
from src.domain.schemas.file import FileData
from src.domain.schemas.link import Link
from src.domain.schemas.user import User
from src.domain.services.password import crypt_password, verify_password
from src.infrastructure.storage.client import AsyncStorageClient

_B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def _uuid_to_base62(uid: uuid_lib.UUID) -> str:
    n = uid.int
    result = []
    while n:
        result.append(_B62[n % 62])
        n //= 62
    return "".join(reversed(result))


class FileService:
    IMAGES: list[str] = ["jpg", "jpeg", "png", "gif", "webp"]
    VIDEOS: list[str] = ["mp4", "webm", "ogg", "mov"]
    PDF: list[str] = ["pdf"]
    TEXT: list[str] = ["html", "txt", "log", "csv", "json", "xml"]

    _SUBTYPE_OVERRIDES: dict[str, str] = {"jpg": "jpeg", "mov": "quicktime"}
    _TEXT_CONTENT_TYPE: str = "text/plain; charset=utf-8"
    _FALLBACK_CONTENT_TYPE: str = "application/octet-stream"

    @classmethod
    def safe_content_type(cls, extension: str) -> tuple[str, bool]:
        """Map an extension to (content_type, as_attachment) via a fixed allowlist."""
        ext = extension.lower().lstrip(".")
        subtype = cls._SUBTYPE_OVERRIDES.get(ext, ext)
        if ext in cls.IMAGES:
            return f"image/{subtype}", False
        if ext in cls.VIDEOS:
            return f"video/{subtype}", False
        if ext in cls.PDF:
            return "application/pdf", False
        if ext in cls.TEXT:
            return cls._TEXT_CONTENT_TYPE, False
        return cls._FALLBACK_CONTENT_TYPE, True

    def __init__(self) -> None:
        self._storage = AsyncStorageClient()

    async def upload(
        self,
        file: UploadFile,
        db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
        user: User | None,
        password: str | None = None,
    ) -> Link:
        if not file.filename:
            raise BadRequest(detail="No filename")

        password = password.strip() if password else None

        if password is not None and user is None:
            raise Unauthorized()

        extension = file.filename.split(".")[-1].lower()
        if extension not in self.IMAGES + self.VIDEOS + self.PDF + self.TEXT:
            raise BadRequest(detail="Invalid Format")

        if user is None:
            max_size = settings.ANON_MAX_SIZE_BYTES
            ttl_days: int | None = settings.ANON_TTL_DAYS
        elif user.is_paid:
            max_size = settings.PAID_MAX_SIZE_BYTES
            ttl_days = None  # permanent
        else:
            max_size = settings.REGISTERED_MAX_SIZE_BYTES
            ttl_days = settings.REGISTERED_TTL_DAYS

        content = await file.read()
        if len(content) > max_size:
            raise FileTooLarge()

        uid = uuid_lib.uuid4()
        filename = f"{uid}.{extension}"
        short_id = _uuid_to_base62(uid)
        content_type, _ = self.safe_content_type(extension)

        await self._storage.upload(filename, content, content_type)

        await db.files.insert_one(
            {
                "filename": filename,
                "short_id": short_id,
                "original_filename": file.filename,
                "user_id": user.id if user else None,
                "size_bytes": len(content),
                "password_hash": crypt_password(password) if password else None,
                "expires_at": datetime.now(UTC) + timedelta(days=ttl_days)
                if ttl_days is not None
                else None,
                "uploaded_at": datetime.now(UTC),
            }
        )

        return Link(value=f"{settings.DOMAIN}/view/{short_id}")

    async def retrieve(
        self,
        short_id: str,
        db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
        password: str | None = None,
    ) -> FileData:
        record = await db.files.find_one(
            {"short_id": short_id}
        ) or await db.files.find_one({"filename": short_id})

        if record and record.get("password_hash"):
            if password is None:
                raise Locked(detail="Password required")
            if not verify_password(password, record["password_hash"]):
                raise Forbidden(detail="Invalid password")

        storage_key = record["filename"] if record else short_id
        data = await self._storage.retrieve(storage_key)
        extension = storage_key.rsplit(".", 1)[-1] if "." in storage_key else ""
        content_type, as_attachment = self.safe_content_type(extension)

        return FileData(
            filename=record.get("original_filename", storage_key)
            if record
            else storage_key,
            content=data.content,
            content_type=content_type,
            as_attachment=as_attachment,
        )
