"""
Structured logging configuration for ARCHITEX-CAD backend.

Usage:
    from core.logging_config import get_logger, setup_logging
    setup_logging()          # call once at startup
    log = get_logger(__name__)
    log.info("Server ready", port=8000)
"""

import json
import logging
import os
import sys
import traceback
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

# ── Log directory ─────────────────────────────────────────────────────────────

def _log_dir() -> Path:
    here = Path(__file__).resolve().parent.parent  # python/
    d = here / "logs"
    d.mkdir(exist_ok=True)
    return d


# ── JSON formatter ────────────────────────────────────────────────────────────

class JSONFormatter(logging.Formatter):
    """Emit one JSON object per line: {timestamp, level, source, message, ...extra}"""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "source": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            entry["stack"] = self.formatException(record.exc_info)
        # Attach any extra context passed via logger.info(..., extra={"ctx": ...})
        for key in ("ctx", "route", "method", "status_code", "duration_ms", "payload"):
            val = getattr(record, key, None)
            if val is not None:
                entry[key] = val
        return json.dumps(entry, default=str)


# ── Setup ─────────────────────────────────────────────────────────────────────

_configured = False


def setup_logging(level: str = "INFO") -> None:
    global _configured
    if _configured:
        return
    _configured = True

    log_dir = _log_dir()
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    # Root logger
    root = logging.getLogger()
    root.setLevel(numeric_level)

    # Console handler (plain text for dev readability)
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(numeric_level)
    console.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)-8s] %(name)s — %(message)s", "%H:%M:%S")
    )
    root.addHandler(console)

    # Rotating JSON file — all logs (7-day rotation, 10 MB each)
    app_handler = RotatingFileHandler(
        log_dir / "app.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=7,
        encoding="utf-8",
    )
    app_handler.setLevel(numeric_level)
    app_handler.setFormatter(JSONFormatter())
    root.addHandler(app_handler)

    # Dedicated error log (WARNING+)
    error_handler = RotatingFileHandler(
        log_dir / "errors.log",
        maxBytes=5 * 1024 * 1024,
        backupCount=14,
        encoding="utf-8",
    )
    error_handler.setLevel(logging.WARNING)
    error_handler.setFormatter(JSONFormatter())
    root.addHandler(error_handler)

    # Suppress noisy third-party loggers
    for noisy in ("uvicorn.access", "multipart", "watchfiles"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger("architex").info(
        "Logging initialised",
        extra={"ctx": {"log_dir": str(log_dir), "level": level}},
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
