"""
AI-4.5 + PERF-3.4 — Response cache layer.

Provides a general-purpose cache backed by Redis (when available) with
automatic fallback to an in-process LRU dict so the app never breaks
if Redis is down.

Usage:
    from app.services.cache_service import cache

    # Store / retrieve arbitrary JSON-serialisable data
    cache.set("my:key", {"foo": 1}, ttl=300)
    data = cache.get("my:key")

    # Decorator for caching function results
    @cache.cached(ttl=600, key_prefix="graph")
    def expensive_query(session_id: str): ...
"""
import functools
import hashlib
import json
import time
from collections import OrderedDict
from typing import Any, Callable, Optional

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

# ── In-process LRU fallback ────────────────────────────────────

_MAX_LRU = 512


class _LRUCache:
    """Thread-safe-ish bounded dict with TTL, used when Redis is unavailable."""

    def __init__(self, maxsize: int = _MAX_LRU):
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._maxsize = maxsize

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires, value = entry
        if expires and time.time() > expires:
            self._store.pop(key, None)
            return None
        self._store.move_to_end(key)
        return value

    def set(self, key: str, value: Any, ttl: int = 0):
        expires = (time.time() + ttl) if ttl > 0 else 0.0
        self._store[key] = (expires, value)
        self._store.move_to_end(key)
        while len(self._store) > self._maxsize:
            self._store.popitem(last=False)

    def delete(self, key: str):
        self._store.pop(key, None)

    def flush(self):
        self._store.clear()


# ── Cache service ──────────────────────────────────────────────

class CacheService:
    """
    Unified cache with Redis primary + LRU fallback.

    All public methods are safe to call even when Redis is disabled
    or unreachable — they silently degrade to the in-process LRU.
    """

    def __init__(self):
        self._redis = None
        self._redis_checked = False
        self._lru = _LRUCache()

    # ── Redis lazy-init ──

    def _r(self):
        if not settings.redis_enabled:
            return None
        if self._redis_checked:
            return self._redis
        try:
            import redis as _redis_lib

            client = _redis_lib.Redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
            )
            client.ping()
            self._redis = client
            logger.info("CacheService: Redis connected")
        except Exception as exc:
            logger.warning(f"CacheService: Redis unavailable ({exc}), using LRU")
            self._redis = None
        self._redis_checked = True
        return self._redis

    # ── Public API ──

    def get(self, key: str) -> Optional[Any]:
        r = self._r()
        full_key = f"{settings.cache_prefix}{key}"
        if r:
            try:
                raw = r.get(full_key)
                if raw is not None:
                    return json.loads(raw)
            except Exception:
                pass
        return self._lru.get(full_key)

    def set(self, key: str, value: Any, ttl: int = 0) -> None:
        full_key = f"{settings.cache_prefix}{key}"
        ttl = ttl or settings.cache_ttl_seconds
        serialised = json.dumps(value, default=str)
        r = self._r()
        if r:
            try:
                r.setex(full_key, ttl, serialised)
            except Exception:
                pass
        self._lru.set(full_key, value, ttl)

    def delete(self, key: str) -> None:
        full_key = f"{settings.cache_prefix}{key}"
        r = self._r()
        if r:
            try:
                r.delete(full_key)
            except Exception:
                pass
        self._lru.delete(full_key)

    def flush_prefix(self, prefix: str) -> None:
        """Delete all keys matching ``cache_prefix + prefix + *``."""
        full = f"{settings.cache_prefix}{prefix}"
        r = self._r()
        if r:
            try:
                for k in r.scan_iter(f"{full}*"):
                    r.delete(k)
            except Exception:
                pass
        # LRU — scan and remove
        to_remove = [k for k in self._lru._store if k.startswith(full)]
        for k in to_remove:
            self._lru.delete(k)

    # ── Decorator ──

    def cached(
        self,
        ttl: int = 0,
        key_prefix: str = "fn",
    ) -> Callable:
        """
        Decorator that caches the return value of a sync function.

        The cache key is derived from the function name + args hash.
        """

        def decorator(fn: Callable) -> Callable:
            @functools.wraps(fn)
            def wrapper(*args, **kwargs):
                raw = json.dumps(
                    {"a": [str(a) for a in args], "k": {str(k): str(v) for k, v in kwargs.items()}},
                    sort_keys=True,
                )
                digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
                key = f"{key_prefix}:{fn.__name__}:{digest}"
                hit = self.get(key)
                if hit is not None:
                    return hit
                result = fn(*args, **kwargs)
                self.set(key, result, ttl)
                return result

            return wrapper

        return decorator


# Global instance
cache = CacheService()
