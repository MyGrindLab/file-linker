import logging
from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.core.settings import settings
from src.infrastructure.storage.client import AsyncStorageClient

logger = logging.getLogger(__name__)


def create_scheduler(
    db: AsyncIOMotorDatabase,  # type: ignore[type-arg]
    storage: AsyncStorageClient,
) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()

    async def cleanup_expired_files() -> None:
        now = datetime.now(UTC)

        cursor = db.files.find({"expires_at": {"$lt": now, "$ne": None}})
        deleted = 0

        async for record in cursor:
            filename = record.get("filename", "")
            try:
                await storage.delete(filename, settings.STORAGE_BUCKET)
            except Exception:
                logger.warning("Failed to delete %s from S3", filename)

            await db.files.delete_one({"_id": record["_id"]})

            deleted += 1
        if deleted:
            logger.info("Cleanup: removed %d expired file(s)", deleted)

    scheduler.add_job(
        cleanup_expired_files,
        "interval",
        hours=settings.CLEANUP_INTERVAL_HOURS,
    )
    return scheduler
