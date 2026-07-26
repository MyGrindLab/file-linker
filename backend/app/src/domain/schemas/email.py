from uuid import UUID

from pydantic import BaseModel


class EmailMessage(BaseModel):
    title: str
    template_path: str
    data: dict  # type: ignore[type-arg]
    to: list[str]


class EmailCheck(BaseModel):
    email: str
    code: int


class CheckResult(BaseModel):
    id: UUID
