import logging
import traceback
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.core.exceptions import BaseHTTPException
from src.core.settings import settings

logger = logging.getLogger("EXCEPTION_HANDLER")


def _get_request_info(request: Request) -> str:
    method = getattr(request, "method", "WS")

    path = request.url.path
    query = request.url.query

    return f"{method} {path}{'?' + query if query else ''}"


def _log_request_error(
    request: Request, status_code: int, error_detail: str, level: str = "warning"
) -> None:
    request_info = _get_request_info(request)
    log_message = "%s %s - %s"

    if level == "error":
        logger.error(log_message, request_info, status_code, error_detail)
    else:
        logger.warning(log_message, request_info, status_code, error_detail)


def _create_error_response(
    status_code: int,
    error_content: dict[str, Any],
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code, headers=headers or {}, content=error_content
    )


def add_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(BaseHTTPException)
    async def base_http_exception_handler(
        request: Request, exc: BaseHTTPException
    ) -> JSONResponse:
        _log_request_error(request, exc.status_code, exc.detail)
        return _create_error_response(
            status_code=exc.status_code,
            error_content={"error": exc.detail},
            headers=dict(exc.headers) if exc.headers else None,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        status_code = status.HTTP_422_UNPROCESSABLE_ENTITY

        errors_description = [
            error["msg"].replace("Value error, ", "") for error in exc.errors()
        ]

        _log_request_error(request, status_code, str(exc.errors()))

        # Format response content
        content = {
            "error": (
                errors_description[0]
                if len(errors_description) == 1
                else errors_description
            )
        }

        return _create_error_response(status_code, content)

    @app.exception_handler(Exception)
    async def unknown_error_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

        if settings.DEBUG:
            # In debug mode, return detailed traceback
            error_path = "".join(traceback.format_tb(exc.__traceback__))
            return JSONResponse(
                status_code=status_code,
                content=f"Traceback: {error_path}.\nError: {exc}",
                media_type="text/plain",
            )

        _log_request_error(request, status_code, str(exc), level="error")

        return _create_error_response(status_code, {"error": "Unexpected error"})
