from typing import Annotated
from urllib.parse import quote

from fastapi import Depends, File, Form, Header, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.routing import APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.core.security import get_optional_user
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
    disposition = "attachment" if data.as_attachment else "inline"
    response.headers["Content-Disposition"] = (
        f"{disposition}; filename*=UTF-8''{encoded_filename}"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "sandbox"
    response.headers["Access-Control-Expose-Headers"] = "Content-Disposition"
    return response
