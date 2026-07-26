import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from bson import ObjectId
from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorDatabase
from redis.asyncio import Redis

from src.core.exceptions import BadRequest, Unauthorized
from src.core.settings import settings
from src.domain.schemas.user import User
from src.infrastructure.cache.redis import redis_wrapper
from src.infrastructure.database.mongo import get_db

_bearer = HTTPBearer(auto_error=False)


def create_access_token(user_id: str, is_paid: bool = False) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "is_paid": is_paid, "exp": expire},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


async def _get_client_identifier(request: Request) -> str:
    forwarded: str | None = request.headers.get("X-Forwarded-For")

    if forwarded:
        ip = forwarded.split(",")[0]
    else:
        ip = request.client.host if request.client else "localhost"

    return f"{ip}:{request.scope['path']}"


async def _set_rate_limit(request: Request, limit: int = 1, interval: int = 60) -> None:
    if settings.DEBUG:
        return None

    redis: Redis = redis_wrapper.redis

    identifier: str = await _get_client_identifier(request)

    now: int = int(time.time())

    await redis.zremrangebyscore(identifier, 0, now - interval)

    current_count = await redis.zcard(identifier)

    if current_count >= limit:
        raise BadRequest(
            detail=(
                "Exceeded the allowed number of requests "
                f"({limit}) within {interval} seconds"
            ),
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    await redis.zadd(identifier, {str(now): str(now)})

    await redis.expire(identifier, interval)


def get_optional_user(limit: int, interval: int) -> Callable:
    async def _get_optional_user(
        request: Request,
        credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
        db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
    ) -> User | None:
        if credentials is None:
            await _set_rate_limit(request, limit, interval)

            return None
        try:
            payload = jwt.decode(
                credentials.credentials,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )
            user_id: str = payload["sub"]
        except (JWTError, KeyError):
            raise Unauthorized()

        doc = await db.users.find_one({"_id": ObjectId(user_id)})
        if doc is None:
            raise Unauthorized()

        return User(id=str(doc["_id"]), email=doc["email"], is_paid=doc["is_paid"])

    return _get_optional_user


def get_current_user(limit: int, interval: int) -> Callable:
    async def _get_current_user(
        user: User | None = Depends(get_optional_user(limit, interval)),
    ) -> User:
        if user is None:
            raise Unauthorized()
        return user

    return _get_current_user
