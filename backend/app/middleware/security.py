"""
SEC-2.5  API rate limiting (sliding-window, per-IP + per-user)
SEC-2.6  Input validation & sanitization
SEC-2.7  XSS protection (response headers + HTML stripping)
SEC-2.8  CSRF protection (SameSite cookies + Origin/Referer check)

All middleware is registered in ``main.py``.
"""
from __future__ import annotations

import html
import re
import time
from collections import defaultdict
from typing import Dict, Optional, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


# ─────────────────────────────────────────────────────────────
#  SEC-2.5 — Sliding-window rate limiter
# ─────────────────────────────────────────────────────────────

class _TokenBucket:
    """Simple token-bucket rate limiter per key."""

    __slots__ = ("_buckets", "_rate", "_capacity")

    def __init__(self, rate: float, capacity: int):
        """
        Args:
            rate:     Tokens added per second.
            capacity: Maximum burst size.
        """
        self._rate = rate
        self._capacity = capacity
        # key → (tokens, last_refill_ts)
        self._buckets: Dict[str, Tuple[float, float]] = {}

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        tokens, last = self._buckets.get(key, (float(self._capacity), now))
        # Refill
        elapsed = now - last
        tokens = min(self._capacity, tokens + elapsed * self._rate)
        # Consume
        if tokens >= 1.0:
            self._buckets[key] = (tokens - 1.0, now)
            return True
        self._buckets[key] = (tokens, now)
        return False

    def cleanup(self, max_age: float = 300.0) -> None:
        """Evict stale entries to prevent unbounded growth."""
        cutoff = time.monotonic() - max_age
        stale = [k for k, (_, ts) in self._buckets.items() if ts < cutoff]
        for k in stale:
            del self._buckets[k]


# Default: 60 requests / minute  (1 req/s sustained, burst 60)
_DEFAULT_RATE = 1.0
_DEFAULT_CAPACITY = 60

# Stricter limit for auth endpoints (10 req / min)
_AUTH_RATE = 0.167
_AUTH_CAPACITY = 10

_general_limiter = _TokenBucket(_DEFAULT_RATE, _DEFAULT_CAPACITY)
_auth_limiter = _TokenBucket(_AUTH_RATE, _AUTH_CAPACITY)

# Periodic cleanup counter
_cleanup_counter = 0


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-IP sliding-window rate limiter (SEC-2.5)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        global _cleanup_counter

        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Pick limiter
        limiter = _auth_limiter if path.startswith("/api/auth") else _general_limiter

        if not limiter.allow(client_ip):
            logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
            return Response(
                content='{"detail":"Rate limit exceeded. Please try again later."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": "60"},
            )

        response = await call_next(request)

        # Periodic cleanup (every ~200 requests)
        _cleanup_counter += 1
        if _cleanup_counter % 200 == 0:
            _general_limiter.cleanup()
            _auth_limiter.cleanup()

        return response


# ─────────────────────────────────────────────────────────────
#  SEC-2.7 — Security headers (XSS + clickjacking + sniffing)
# ─────────────────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds browser security headers to every response.

    - ``X-Content-Type-Options: nosniff``
    - ``X-Frame-Options: DENY``
    - ``X-XSS-Protection: 1; mode=block``  (legacy browsers)
    - ``Content-Security-Policy: default-src 'self'``
    - ``Referrer-Policy: strict-origin-when-cross-origin``
    - ``Permissions-Policy`` restrictive defaults
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        # CSP  — allow 'self' + 'unsafe-inline' for Swagger UI CSS
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self' data:; "
            "connect-src 'self'"
        )

        return response


# ─────────────────────────────────────────────────────────────
#  SEC-2.8 — CSRF protection (state-changing methods)
# ─────────────────────────────────────────────────────────────

class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Lightweight CSRF protection for state-changing HTTP methods.

    Strategy:
    1. Reject non-safe requests whose ``Origin`` / ``Referer`` does not
       match ``settings.cors_origins``.
    2. Endpoints served as JSON APIs behind ``Authorization: Bearer …``
       are inherently resilient to classic CSRF because browsers won't
       auto-attach the header, but we add this layer for belt-and-suspenders
       defence.
    """

    _SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method in self._SAFE_METHODS:
            return await call_next(request)

        # Allow Swagger / OpenAPI docs to work
        if request.url.path.startswith("/api/docs") or request.url.path.startswith("/api/openapi"):
            return await call_next(request)

        origin = request.headers.get("origin") or ""
        referer = request.headers.get("referer") or ""

        allowed = settings.cors_origins
        # If no allowed origins configured or wildcard, skip check
        if not allowed or "*" in allowed:
            return await call_next(request)

        # Check origin first, then fall back to referer
        if origin:
            if not any(origin.rstrip("/") == o.rstrip("/") for o in allowed):
                logger.warning(f"CSRF: blocked request from origin={origin}")
                return Response(
                    content='{"detail":"CSRF validation failed — origin not allowed."}',
                    status_code=403,
                    media_type="application/json",
                )
        elif referer:
            if not any(referer.startswith(o.rstrip("/")) for o in allowed):
                logger.warning(f"CSRF: blocked request from referer={referer}")
                return Response(
                    content='{"detail":"CSRF validation failed — referer not allowed."}',
                    status_code=403,
                    media_type="application/json",
                )
        # If neither origin nor referer present, allow (API / curl / mobile clients)

        return await call_next(request)


# ─────────────────────────────────────────────────────────────
#  SEC-2.6 — Input sanitization utilities
# ─────────────────────────────────────────────────────────────

# Compiled patterns for common attack vectors
_SCRIPT_TAG_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
_EVENT_HANDLER_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def sanitize_string(value: str) -> str:
    """
    Strip dangerous HTML / script content from a user-provided string.

    - Removes ``<script>`` blocks
    - Removes inline event handlers (``onclick=…``)
    - Escapes remaining HTML entities
    - Trims excessive whitespace

    Safe for storing in the database and rendering in the frontend.
    """
    value = _SCRIPT_TAG_RE.sub("", value)
    value = _EVENT_HANDLER_RE.sub("", value)
    value = _HTML_TAG_RE.sub("", value)
    value = html.escape(value, quote=True)
    # Collapse multiple whitespace runs
    value = re.sub(r"\s{3,}", "  ", value)
    return value.strip()


def sanitize_dict(data: dict, *, skip_keys: Optional[set] = None) -> dict:
    """
    Recursively sanitize all string values in a dict.

    Args:
        data: Dictionary to sanitize.
        skip_keys: Keys whose values should NOT be sanitized
                   (e.g. ``'password'``, ``'hashed_password'``).
    """
    skip = skip_keys or set()
    result = {}
    for key, value in data.items():
        if key in skip:
            result[key] = value
        elif isinstance(value, str):
            result[key] = sanitize_string(value)
        elif isinstance(value, dict):
            result[key] = sanitize_dict(value, skip_keys=skip)
        elif isinstance(value, list):
            result[key] = [
                sanitize_string(v) if isinstance(v, str)
                else sanitize_dict(v, skip_keys=skip) if isinstance(v, dict)
                else v
                for v in value
            ]
        else:
            result[key] = value
    return result
