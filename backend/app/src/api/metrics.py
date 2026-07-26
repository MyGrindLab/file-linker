import os

from fastapi import APIRouter
from fastapi.responses import Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    generate_latest,
    multiprocess,
)

metrics_router = APIRouter(tags=["Technical"])


@metrics_router.get("/metrics", include_in_schema=False)
async def metrics() -> Response:
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        data = generate_latest(registry)
    else:
        data = generate_latest()

    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
