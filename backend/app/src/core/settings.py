from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "File Linker"
    DEBUG: bool = False

    DOMAIN: str = "http://path"

    STORAGE_PATH: str = "path"
    STORAGE_USER: str = "user"
    STORAGE_PASS: str = "pass"
    STORAGE_BUCKET: str = "bucket"

    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_USERNAME: str = ""
    REDIS_PASSWORD: str = ""

    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "file_linker"

    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days

    SALT_LENGTH: int = 12

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_SUCCESS_URL: str = ""
    STRIPE_CANCEL_URL: str = ""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    FRONTEND_URL: str = "http://localhost:3000"

    MAIL_USERNAME: str = "username"
    MAIL_PASSWORD: SecretStr = SecretStr("password")
    MAIL_FROM: str = "from@mail.com"
    MAIL_PORT: int = 25
    MAIL_SERVER: str = "mail-server.com"
    MAIL_STARTTLS: bool = False
    MAIL_SSL_TLS: bool = False

    EMAIL_VERIFY_TTL_SECONDS: int = 3600  # 1 hour

    CLEANUP_INTERVAL_HOURS: int = 1

    ANON_MAX_SIZE_BYTES: int = 10 * 1024 * 1024
    REGISTERED_MAX_SIZE_BYTES: int = 10 * 1024 * 1024
    PAID_MAX_SIZE_BYTES: int = 100 * 1024 * 1024
    ANON_TTL_DAYS: int = 1
    REGISTERED_TTL_DAYS: int = 10


settings: Settings = Settings()
