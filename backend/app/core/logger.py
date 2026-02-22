"""
Structured logging configuration using structlog.
"""
import logging
import sys
from typing import Any
from app.core.config import settings

try:
    import structlog  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    structlog = None  # type: ignore


def configure_logging() -> None:
    """Configure structured logging for the application."""

    # Prefer structlog when installed; fall back to stdlib logging otherwise.
    if structlog is None:
        logging.basicConfig(
            level=getattr(logging, settings.log_level.upper(), logging.INFO),
            format="%(asctime)s %(levelname)s %(name)s - %(message)s",
            stream=sys.stdout,
        )
        return

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
            if settings.log_format == "json"
            else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.log_level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> Any:
    """Get a structured logger instance."""
    if structlog is None:
        return logging.getLogger(name)
    return structlog.get_logger(name)


# Initialize logging
configure_logging()
logger = get_logger(__name__)
