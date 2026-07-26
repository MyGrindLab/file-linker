from datetime import UTC, datetime

from fastapi import BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext

from src.core.exceptions import BadRequest, Unauthorized
from src.domain.schemas.email import EmailCheck
from src.domain.schemas.user import User
from src.domain.services.password import crypt_password, verify_password
from src.infrastructure.email.sender import send_code_to_email, verify_email_code

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:  # type: ignore[type-arg]
        self._db = db

    async def register(self, email: str, password: str, bg: BackgroundTasks) -> None:
        existing = await self._db.users.find_one({"email": email})
        if existing is not None:
            raise BadRequest(detail="Email already registered")

        doc = {
            "email": email,
            "password": crypt_password(password),
            "oauth_provider": None,
            "oauth_id": None,
            "is_paid": False,
            "is_verified": False,
            "stripe_customer_id": None,
            "created_at": datetime.now(UTC),
        }
        await self._db.users.insert_one(doc)
        await send_code_to_email(email, bg)

    async def verify_email(self, data: EmailCheck) -> User:
        await verify_email_code(data)

        doc = await self._db.users.find_one({"email": data.email})
        if doc is None:
            raise BadRequest(detail="User not found")

        await self._db.users.update_one(
            {"_id": doc["_id"]}, {"$set": {"is_verified": True}}
        )
        return User(id=str(doc["_id"]), email=doc["email"], is_paid=doc["is_paid"])

    async def login(self, email: str, password: str) -> User:
        doc = await self._db.users.find_one({"email": email})

        if doc is None or not doc.get("password"):
            raise Unauthorized(detail="Invalid credentials")

        if not verify_password(password, doc["password"]):
            raise Unauthorized(detail="Invalid credentials")

        if not doc.get("is_verified", True):
            raise Unauthorized(detail="Email not verified. Please check your inbox.")

        return User(id=str(doc["_id"]), email=doc["email"], is_paid=doc["is_paid"])

    async def find_or_create_oauth_user(
        self, email: str, provider: str, oauth_id: str
    ) -> User:
        doc = await self._db.users.find_one(
            {"oauth_provider": provider, "oauth_id": oauth_id}
        )
        if doc is None:
            doc = await self._db.users.find_one({"email": email})

        if doc is not None:
            return User(id=str(doc["_id"]), email=doc["email"], is_paid=doc["is_paid"])

        new_doc = {
            "email": email,
            "password": None,
            "oauth_provider": provider,
            "oauth_id": oauth_id,
            "is_paid": False,
            "is_verified": True,  # OAuth provider already confirmed the email
            "stripe_customer_id": None,
            "created_at": datetime.now(UTC),
        }
        result = await self._db.users.insert_one(new_doc)
        return User(id=str(result.inserted_id), email=email, is_paid=False)
