"""
Request metrics middleware for monitoring API performance.
"""
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.core.logger import get_logger

logger = get_logger(__name__)


class MetricsMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track request metrics including duration, status codes, and errors.
    """
    
    def __init__(self, app: ASGIApp):
        """
        Initialize metrics middleware.
        
        Args:
            app: FastAPI application instance
        """
        super().__init__(app)
        self.request_count = 0
        self.error_count = 0
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request and track metrics.
        
        Args:
            request: Incoming request
            call_next: Next middleware or route handler
        
        Returns:
            Response with added metrics headers
        """
        # Increment request counter
        self.request_count += 1
        request_number = self.request_count
        
        # Record start time
        start_time = time.time()
        
        # Get request details
        request_method = request.method
        request_path = request.url.path
        client_host = request.client.host if request.client else "unknown"
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration_seconds = time.time() - start_time
            duration_milliseconds = duration_seconds * 1000
            
            # Get response status
            status_code = response.status_code
            
            # Track errors
            if status_code >= 500:
                self.error_count += 1
                logger.error(
                    f"Request #{request_number}: {request_method} {request_path} "
                    f"from {client_host} returned {status_code} "
                    f"in {duration_milliseconds:.2f}ms"
                )
            elif status_code >= 400:
                logger.warning(
                    f"Request #{request_number}: {request_method} {request_path} "
                    f"from {client_host} returned {status_code} "
                    f"in {duration_milliseconds:.2f}ms"
                )
            else:
                logger.info(
                    f"Request #{request_number}: {request_method} {request_path} "
                    f"from {client_host} returned {status_code} "
                    f"in {duration_milliseconds:.2f}ms"
                )
            
            # Add custom headers with metrics
            response.headers["X-Request-ID"] = str(request_number)
            response.headers["X-Response-Time"] = f"{duration_milliseconds:.2f}ms"
            
            return response
        
        except Exception as error_instance:
            # Calculate duration even on error
            duration_seconds = time.time() - start_time
            duration_milliseconds = duration_seconds * 1000
            
            # Track error
            self.error_count += 1
            
            logger.error(
                f"Request #{request_number}: {request_method} {request_path} "
                f"from {client_host} raised exception after {duration_milliseconds:.2f}ms: "
                f"{str(error_instance)}"
            )
            
            # Re-raise the exception
            raise


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
