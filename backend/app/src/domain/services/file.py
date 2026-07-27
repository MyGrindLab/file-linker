import logging
import mimetypes
import uuid as uuid_lib
from datetime import UTC, datetime, timedelta

from fastapi import UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.core.exceptions import (
    BadRequest,
    FileTooLarge,
    Forbidden,
    Gone,
    Locked,
    NotFound,
    Unauthorized,
)
from src.core.settings import settings
from src.domain.schemas.file import FileData, FileInfo, FileList
from src.domain.schemas.link import Link
from src.domain.schemas.user import User
from src.domain.services.password import crypt_password, verify_password
from src.infrastructure.storage.client import AsyncStorageClient

logger = logging.getLogger(__name__)

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

    def __init__(self) -> None:
        self._storage = AsyncStorageClient()

    def _validate_extension(self, filename: str) -> str:
        extension = filename.split(".")[-1].lower()
        if extension not in self.IMAGES + self.VIDEOS + self.PDF + self.TEXT:
            raise BadRequest(detail="Invalid Format")
        return extension

    def _tier_limits(self, user: User | None) -> tuple[int, int | None]:
        if user is None:
            return settings.ANON_MAX_SIZE_BYTES, settings.ANON_TTL_DAYS
        if user.is_paid:
            return settings.PAID_MAX_SIZE_BYTES, None  # permanent
        return settings.REGISTERED_MAX_SIZE_BYTES, settings.REGISTERED_TTL_DAYS

    async def _owned(
        self,
        short_id: str,
        db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
        user: User,
    ) -> dict:
        record = await db.files.find_one({"short_id": short_id, "user_id": user.id})
        if record is None or record.get("is_active", True) is False:
            raise NotFound(detail="File not found")
        return record

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

        extension = self._validate_extension(file.filename)

        max_size, ttl_days = self._tier_limits(user)

        content = await file.read()
        if len(content) > max_size:
            raise FileTooLarge()

        uid = uuid_lib.uuid4()
        filename = f"{uid}.{extension}"
        short_id = _uuid_to_base62(uid)
        content_type = (
            mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        )

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

        if record and record.get("is_active", True) is False:
            raise Gone(detail="Link is no longer active")

        if record and record.get("password_hash"):
            if password is None:
                raise Locked(detail="Password required")
            if not verify_password(password, record["password_hash"]):
                raise Forbidden(detail="Invalid password")

        storage_key = record["filename"] if record else short_id
        data = await self._storage.retrieve(storage_key)

        return FileData(
            filename=record.get("original_filename", storage_key)
            if record
            else storage_key,
            content=data.content,
            content_type=data.content_type,
        )

    async def list_files(
        self,
        db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
        user: User,
        limit: int,
        offset: int,
    ) -> FileList:
        query = {"user_id": user.id, "is_active": {"$ne": False}}

        cursor = db.files.find(query).sort("uploaded_at", -1).skip(offset).limit(limit)
        items = [FileInfo.from_record(record) async for record in cursor]
        total = await db.files.count_documents(query)

        return FileList(items=items, total=total)

    async def replace_content(
        self,
        short_id: str,
        file: UploadFile,
        db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
        user: User,
    ) -> FileInfo:
        record = await self._owned(short_id, db, user)

        if not file.filename:
            raise BadRequest(detail="No filename")

        new_extension = self._validate_extension(file.filename)

        max_size, _ = self._tier_limits(user)

        content = await file.read()
        if len(content) > max_size:
            raise FileTooLarge()

        old_key = record["filename"]
        uid = old_key.rsplit(".", 1)[0]
        new_key = f"{uid}.{new_extension}"
        content_type = (
            mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        )

        await self._storage.upload(new_key, content, content_type)

        updated_fields = {
            "filename": new_key,
            "original_filename": file.filename,
            "size_bytes": len(content),
            "updated_at": datetime.now(UTC),
        }

        await db.files.update_one({"_id": record["_id"]}, {"$set": updated_fields})

        if new_key != old_key:
            try:
                await self._storage.delete(old_key)
            except Exception:
                logger.warning("Failed to delete %s from S3", old_key)

        return FileInfo.from_record({**record, **updated_fields})

    async def set_password(
        self,
        short_id: str,
        password: str,
        db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
        user: User,
    ) -> None:
        record = await self._owned(short_id, db, user)

        await db.files.update_one(
            {"_id": record["_id"]},
            {"$set": {"password_hash": crypt_password(password)}},
        )

    async def remove_password(
        self,
        short_id: str,
        db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
        user: User,
    ) -> None:
        record = await self._owned(short_id, db, user)

        await db.files.update_one(
            {"_id": record["_id"]},
            {"$set": {"password_hash": None}},
        )

    async def delete(
        self,
        short_id: str,
        db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
        user: User,
    ) -> None:
        record = await self._owned(short_id, db, user)

        try:
            await self._storage.delete(record["filename"])
        except Exception:
            logger.warning("Failed to delete %s from S3", record["filename"])

        await db.files.update_one(
            {"_id": record["_id"]},
            {"$set": {"is_active": False, "deactivated_at": datetime.now(UTC)}},
        )
