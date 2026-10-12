import logging.config
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from src.api.auth import auth_router
from src.api.file import file_router
from src.api.health import health_router
from src.api.metrics import metrics_router
from src.api.payment import payment_router
from src.api.user import user_router
from src.core.handlers import add_exception_handlers
from src.core.logging import LOG_CONFIG
from src.core.settings import settings
from src.infrastructure.cache.redis import RedisWrapper
from src.infrastructure.database.mongo import MongoDBInstance, get_db
from src.infrastructure.metrics.http import prometheus_http_middleware
from src.infrastructure.scheduler.cleanup import create_scheduler
from src.infrastructure.storage.client import AsyncStorageClient

logging.config.dictConfig(LOG_CONFIG)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    mongo = MongoDBInstance()
    mongo.init_db()

    db = get_db()
    await db.files.create_index("short_id", unique=True, sparse=True)
    await db.files.create_index([("user_id", 1), ("uploaded_at", -1)])

    redis = RedisWrapper()

    redis.init()

    storage = AsyncStorageClient()
    scheduler = create_scheduler(db, storage)
    scheduler.start()

    yield

    scheduler.shutdown()

    await redis.close()

    mongo.close_db()


app = FastAPI(
    title=settings.APP_NAME,
    docs_url=None,
    redoc_url=None,
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

add_exception_handlers(app)

app.middleware("http")(prometheus_http_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else [settings.DOMAIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/api/static", StaticFiles(directory="static"), name="static")
app.openapi_version = "3.0.0"

app.include_router(file_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(payment_router, prefix="/api")
app.include_router(user_router, prefix="/api")


@app.get("/api/docs", include_in_schema=False)
async def custom_swagger_ui_html() -> HTMLResponse:
    return get_swagger_ui_html(
        openapi_url="/api/openapi.json",
        title=app.title + " - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="/api/static/swagger/swagger-ui-bundle.js",
        swagger_css_url="/api/static/swagger/swagger-ui.css",
    )
