from pycommontools.resources.singleton import Singleton
from redis.asyncio import Redis

from src.core.settings import settings


class RedisNotInitialized(Exception):
    def __init__(self, error: str = "RedisInstance is not initialized"):
        super().__init__(error)


class RedisWrapper(metaclass=Singleton):
    def __init__(self) -> None:
        self._async_redis: Redis | None = None

    def init(self) -> None:
        self._async_redis = Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            username=settings.REDIS_USERNAME or None,
            password=settings.REDIS_PASSWORD or None,
        )

    @property
    def redis(self) -> Redis:
        if not self._async_redis:
            raise RedisNotInitialized

        return self._async_redis

    async def close(self) -> None:
        if self._async_redis:
            await self._async_redis.close()


redis_wrapper: RedisWrapper = RedisWrapper()
