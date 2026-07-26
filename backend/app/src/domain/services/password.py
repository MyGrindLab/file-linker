import bcrypt

from src.core.settings import settings


def crypt_password(password: str, salt_length: int = settings.SALT_LENGTH) -> str:
    salt: bytes = bcrypt.gensalt(salt_length)

    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, _hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), _hash.encode())
