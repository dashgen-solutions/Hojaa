"""
Request metrics middleware for monitoring API performance.

PERF-1.1: Includes sliding-window histogram for P50/P95/P99 latency
calculation, per-route breakdown, and a ``/metrics`` JSON endpoint.
"""
import bisect
import time
import threading
from collections import defaultdict, deque
from typing import Dict, Any
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.core.logger import get_logger

logger = get_logger(__name__)

# ──────────────────────────────────────────────────────────────
#  Sliding-window latency histogram (thread-safe, lock-free reads)
# ──────────────────────────────────────────────────────────────

_DEFAULT_WINDOW = 2000  # keep last N durations globally


class _LatencyHistogram:
    """
    Light-weight, bounded histogram backed by a deque.
    Stores the *most recent* ``max_size`` durations in milliseconds.
    Percentile queries sort a snapshot — fast for typical window sizes.
    """

    __slots__ = ("_data", "_lock")

    def __init__(self, max_size: int = _DEFAULT_WINDOW):
        self._data: deque = deque(maxlen=max_size)
        self._lock = threading.Lock()

    def record(self, ms: float) -> None:
        with self._lock:
            self._data.append(ms)

    def percentile(self, p: float) -> float:
        """Return the *p*-th percentile (0–100). Returns 0.0 if empty."""
        with self._lock:
            snapshot = sorted(self._data)
        if not snapshot:
            return 0.0
        idx = int(len(snapshot) * p / 100.0)
        idx = min(idx, len(snapshot) - 1)
        return snapshot[idx]

    def count(self) -> int:
        return len(self._data)


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track request metrics including duration, status codes,
    per-route percentiles, and a ``/metrics`` JSON snapshot.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.request_count = 0
        self.error_count = 0
        # PERF-1.1: Global + per-route histograms
        self._global_hist = _LatencyHistogram(_DEFAULT_WINDOW)
        self._route_hists: Dict[str, _LatencyHistogram] = defaultdict(
            lambda: _LatencyHistogram(500)
        )
        self._status_counts: Dict[int, int] = defaultdict(int)

    # ── public snapshot (served by /metrics route) ──

    def snapshot(self) -> Dict[str, Any]:
        """Return a JSON-friendly metrics snapshot."""
        per_route = {}
        for route, hist in list(self._route_hists.items()):
            per_route[route] = {
                "count": hist.count(),
                "p50_ms": round(hist.percentile(50), 2),
                "p95_ms": round(hist.percentile(95), 2),
                "p99_ms": round(hist.percentile(99), 2),
            }
        return {
            "total_requests": self.request_count,
            "total_errors": self.error_count,
            "global_latency": {
                "count": self._global_hist.count(),
                "p50_ms": round(self._global_hist.percentile(50), 2),
                "p95_ms": round(self._global_hist.percentile(95), 2),
                "p99_ms": round(self._global_hist.percentile(99), 2),
            },
            "status_codes": dict(self._status_counts),
            "per_route": per_route,
        }

    async def dispatch(self, request: Request, call_next) -> Response:
        # Fast-path: serve metrics inline to avoid circular dep
        if request.url.path == "/metrics":
            import json as _json
            body = _json.dumps(self.snapshot(), indent=2).encode()
            return Response(content=body, media_type="application/json")

        self.request_count += 1
        request_number = self.request_count

        start_time = time.time()
        request_method = request.method
        request_path = request.url.path
        client_host = request.client.host if request.client else "unknown"

        # Normalise path for histogram key  (/nodes/abc → /nodes/{id})
        route_key = self._normalise_path(request_path)

        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000

            status_code = response.status_code
            self._status_counts[status_code] += 1

            # Record latency
            self._global_hist.record(duration_ms)
            self._route_hists[route_key].record(duration_ms)

            if status_code >= 500:
                self.error_count += 1
                logger.error(
                    f"Request #{request_number}: {request_method} {request_path} "
                    f"from {client_host} returned {status_code} "
                    f"in {duration_ms:.2f}ms"
                )
            elif status_code >= 400:
                logger.warning(
                    f"Request #{request_number}: {request_method} {request_path} "
                    f"from {client_host} returned {status_code} "
                    f"in {duration_ms:.2f}ms"
                )
            else:
                logger.info(
                    f"Request #{request_number}: {request_method} {request_path} "
                    f"from {client_host} returned {status_code} "
                    f"in {duration_ms:.2f}ms"
                )

            response.headers["X-Request-ID"] = str(request_number)
            response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
            return response

        except Exception as error_instance:
            duration_ms = (time.time() - start_time) * 1000
            self.error_count += 1
            self._global_hist.record(duration_ms)
            self._route_hists[route_key].record(duration_ms)

            logger.error(
                f"Request #{request_number}: {request_method} {request_path} "
                f"from {client_host} raised exception after {duration_ms:.2f}ms: "
                f"{str(error_instance)}"
            )
            raise

    @staticmethod
    def _normalise_path(path: str) -> str:
        """
        Replace UUID/integer path segments with ``{id}`` so metrics
        aggregate by route pattern rather than individual resources.
        """
        import re as _re
        # UUIDs
        path = _re.sub(
            r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
            '{id}', path
        )
        # Numeric-only segments
        path = _re.sub(r'/\d+(?=/|$)', '/{id}', path)
        return path


class RequestLogMiddleware(BaseHTTPMiddleware):
    """
    Simple request logging middleware for debugging.
    """
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Log request details.
        
        Args:
            request: Incoming request
            call_next: Next middleware or route handler
        
        Returns:
            Response from next handler
        """
        # Log incoming request
        logger.debug(
            f"Incoming request: {request.method} {request.url.path} "
            f"from {request.client.host if request.client else 'unknown'}"
        )
        
        # Process request
        response = await call_next(request)
        
        # Log response
        logger.debug(
            f"Response: {response.status_code} for {request.method} {request.url.path}"
        )
        
        return response
