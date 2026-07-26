from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.core.exceptions import BadRequest, Unauthorized
from src.domain.schemas.user import UserProfile
from src.domain.services.password import crypt_password, verify_password


class UserService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:  # type: ignore[type-arg]
        self._db = db

    async def get_profile(self, user_id: str) -> UserProfile:
        doc = await self._db.users.find_one({"_id": ObjectId(user_id)})

        if doc is None:
            raise BadRequest(detail="User not found")

        return UserProfile(
            id=str(doc["_id"]),
            email=doc["email"],
            is_paid=doc["is_paid"],
            oauth_provider=doc.get("oauth_provider"),
            created_at=doc["created_at"],
        )

    async def change_password(
        self, user_id: str, old_password: str, new_password: str
    ) -> None:
        doc = await self._db.users.find_one({"_id": ObjectId(user_id)})
        if doc is None:
            raise BadRequest(detail="User not found")

        if not doc.get("password"):
            raise BadRequest(
                detail="Password change is not available for OAuth accounts"
            )

        if not verify_password(old_password, doc["password"]):
            raise Unauthorized(detail="Current password is incorrect")

        await self._db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password": crypt_password(new_password)}},
        )
