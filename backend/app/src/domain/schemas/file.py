from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from src.core.settings import settings


class FileData(BaseModel):
    filename: str = Field(..., description="File name")
    content: bytes = Field(..., description="File content")
    content_type: str = Field(..., description="Content type")


class FileInfo(BaseModel):
    short_id: str = Field(..., description="Short id")
    original_filename: str = Field(..., description="File name")
    size_bytes: int = Field(..., description="File size in bytes")
    uploaded_at: datetime = Field(..., description="Upload timestamp")
    expires_at: datetime | None = Field(..., description="Expiration timestamp")
    has_password: bool = Field(
        ..., description="Whether the file is password protected"
    )
    is_active: bool = Field(..., description="Whether the file is active")
    link: str = Field(..., description="Shareable link")

    @classmethod
    def from_record(cls, record: dict[str, Any]) -> "FileInfo":
        return cls(
            short_id=record["short_id"],
            original_filename=record["original_filename"],
            size_bytes=record["size_bytes"],
            uploaded_at=record["uploaded_at"],
            expires_at=record.get("expires_at"),
            has_password=bool(record.get("password_hash")),
            is_active=record.get("is_active", True),
            link=f"{settings.DOMAIN}/view/{record['short_id']}",
        )


class FileList(BaseModel):
    items: list[FileInfo] = Field(..., description="Files")
    total: int = Field(..., description="Total number of files")


class FilePasswordSet(BaseModel):
    password: str = Field(..., description="Password")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 4 or len(v) > 128:
            raise ValueError("Password must be between 4 and 128 characters")
        return v
