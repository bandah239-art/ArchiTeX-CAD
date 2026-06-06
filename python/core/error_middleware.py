"""
FastAPI exception middleware — logs every unhandled error with route + payload context.

Add to the app AFTER CORSMiddleware:

    from core.error_middleware import register_error_handlers
    register_error_handlers(app)
"""

import time
import traceback
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from core.logging_config import get_logger

log = get_logger("architex.api")


def register_error_handlers(app: FastAPI) -> None:
    """Attach structured error logging to a FastAPI app."""

    @app.middleware("http")
    async def log_requests(request: Request, call_next: Callable) -> Response:
        start = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            if response.status_code >= 400:
                log.warning(
                    "%s %s → %d",
                    request.method,
                    request.url.path,
                    response.status_code,
                    extra={
                        "route": request.url.path,
                        "method": request.method,
                        "status_code": response.status_code,
                        "duration_ms": duration_ms,
                    },
                )
            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            log.error(
                "Unhandled exception on %s %s: %s",
                request.method,
                request.url.path,
                exc,
                exc_info=True,
                extra={
                    "route": request.url.path,
                    "method": request.method,
                    "duration_ms": duration_ms,
                },
            )
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal server error — see python/logs/errors.log",
                    "path": request.url.path,
                },
            )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        log.error(
            "Unhandled exception [exception_handler]: %s",
            exc,
            exc_info=True,
            extra={"route": request.url.path, "method": request.method},
        )
        return JSONResponse(
            status_code=500,
            content={
                "detail": str(exc) or "Internal server error",
                "path": request.url.path,
            },
        )
