from typing import Annotated
from urllib.parse import quote

from fastapi import Depends, File, Form, Header, Query, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.routing import APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.core.security import get_current_user, get_optional_user
from src.domain.schemas.file import FileInfo, FileList, FilePasswordSet
from src.domain.schemas.link import Link
from src.domain.schemas.user import User
from src.domain.services.file import FileService
from src.infrastructure.database.mongo import get_db

file_router = APIRouter(tags=["Files"], prefix="/file")


@file_router.post("/upload/", name="Upload file")
async def upload_file(
    file: UploadFile = File(...),
    password: Annotated[str | None, Form(min_length=4, max_length=128)] = None,
    user: User | None = Depends(get_optional_user(limit=1, interval=60)),
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> Link:
    service = FileService()
    return await service.upload(file, db, user, password)


# NOTE: must be registered before GET /{short_id}/, otherwise that route
# would match "/my/" and swallow this one.
@file_router.get("/my/", name="List my files")
async def list_my_files(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: User = Depends(get_current_user(limit=5, interval=20)),
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> FileList:
    service = FileService()
    return await service.list_files(db, user, limit, offset)


@file_router.put("/{short_id}/content/", name="Replace file content")
async def replace_file_content(
    short_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user(limit=5, interval=20)),
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> FileInfo:
    service = FileService()
    return await service.replace_content(short_id, file, db, user)


@file_router.put("/{short_id}/password/", name="Set file password", status_code=204)
async def set_file_password(
    short_id: str,
    body: FilePasswordSet,
    user: User = Depends(get_current_user(limit=5, interval=20)),
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> None:
    service = FileService()
    await service.set_password(short_id, body.password, db, user)


@file_router.delete(
    "/{short_id}/password/", name="Remove file password", status_code=204
)
async def remove_file_password(
    short_id: str,
    user: User = Depends(get_current_user(limit=5, interval=20)),
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> None:
    service = FileService()
    await service.remove_password(short_id, db, user)


@file_router.delete("/{short_id}/", name="Delete file", status_code=204)
async def delete_file(
    short_id: str,
    user: User = Depends(get_current_user(limit=5, interval=20)),
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> None:
    service = FileService()
    await service.delete(short_id, db, user)


@file_router.get("/{short_id}/", name="Get file")
async def view_file(
    short_id: str,
    x_file_password: Annotated[str | None, Header()] = None,
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> StreamingResponse:
    service = FileService()
    data = await service.retrieve(short_id, db, x_file_password)

    response = StreamingResponse(iter([data.content]), media_type=data.content_type)
    encoded_filename = quote(data.filename, safe="")
    response.headers["Content-Disposition"] = (
        f"inline; filename*=UTF-8''{encoded_filename}"
    )
    response.headers["Access-Control-Expose-Headers"] = "Content-Disposition"
    return response
