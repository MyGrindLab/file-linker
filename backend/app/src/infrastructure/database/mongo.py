from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pycommontools.resources.singleton import Singleton

from src.core.settings import settings


class MongoDBInstance(metaclass=Singleton):
    def __init__(self) -> None:
        self._client: AsyncIOMotorClient | None = None

    def init_db(self) -> None:
        if self._client is not None:
            raise ValueError("MongoDB client is already configured")

        self._client = AsyncIOMotorClient(settings.MONGODB_URL)

    def close_db(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    @property
    def client(self) -> AsyncIOMotorClient:
        if self._client is None:
            raise ValueError("You must run init_db() to configure MongoDBInstance")

        return self._client


def get_db() -> AsyncIOMotorDatabase:
    mongo = MongoDBInstance()

    if mongo.client is None:
        raise RuntimeError("Database not initialized")

    return mongo.client[settings.MONGODB_DB]
