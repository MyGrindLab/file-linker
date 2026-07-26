from datetime import datetime

from pydantic import BaseModel, field_validator


class User(BaseModel):
    id: str
    email: str
    is_paid: bool


class UserProfile(BaseModel):
    id: str
    email: str
    is_paid: bool
    oauth_provider: str | None
    created_at: datetime


class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")

        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")

        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")

        return v


class UserLogin(BaseModel):
    email: str
    password: str


class PasswordChange(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
