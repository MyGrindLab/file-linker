from typing import Any

from src.infrastructure.cache.redis import redis_wrapper


class RedisKeyValueException(Exception):
    pass


class RedisClient:
    async def set_value(self, key: str, value: Any, expire: int = 60) -> None:
        await redis_wrapper.redis.setex(key, expire, str(value))

    async def check_value(self, key: str, value: Any) -> None:
        raw = await redis_wrapper.redis.get(key)
        if raw is None or raw.decode() != str(value):
            raise RedisKeyValueException("Value mismatch or key expired")

    async def delete_value(self, key: str) -> None:
        await redis_wrapper.redis.delete(key)
