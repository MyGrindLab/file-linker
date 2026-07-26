import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from prometheus_client import Counter, Histogram

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ("method", "path", "status_code"),
)

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ("method", "path", "status_code"),
)


async def prometheus_http_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    if request.url.path == "/api/metrics":
        return await call_next(request)

    start = time.perf_counter()
    status_code = "500"

    try:
        response = await call_next(request)
        status_code = str(response.status_code)
        return response
    finally:
        route = request.scope.get("route")
        path = getattr(route, "path", "unmatched")
        labels = (request.method, path, status_code)

        REQUEST_COUNT.labels(*labels).inc()
        REQUEST_DURATION.labels(*labels).observe(time.perf_counter() - start)
