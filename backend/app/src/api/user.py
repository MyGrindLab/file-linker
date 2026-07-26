from fastapi import Depends
from fastapi.routing import APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.core.security import get_current_user
from src.domain.schemas.user import PasswordChange, User, UserProfile
from src.domain.services.user import UserService
from src.infrastructure.database.mongo import get_db

user_router = APIRouter(tags=["User"], prefix="/user")


@user_router.get("/me/", name="Get profile")
async def get_me(
    user: User = Depends(get_current_user(limit=5, interval=20)),
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> UserProfile:
    service = UserService(db)
    return await service.get_profile(user.id)


@user_router.put("/password/", name="Change password", status_code=204)
async def change_password(
    body: PasswordChange,
    user: User = Depends(get_current_user(limit=5, interval=20)),
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> None:
    service = UserService(db)
    await service.change_password(user.id, body.old_password, body.new_password)
