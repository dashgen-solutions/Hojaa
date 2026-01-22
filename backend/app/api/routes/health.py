"""
Health check endpoints for monitoring and observability.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from app.db.session import get_db
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/health", tags=["health"])


@router.get("/", status_code=status.HTTP_200_OK)
async def basic_health_check():
    """
    Basic health check endpoint.
    Returns service status and timestamp.
    
    Returns:
        Dictionary with status and metadata
    """
    return {
        "status": "healthy",
        "service": "mometric-requirements-api",
        "version": settings.app_version,
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.environment
    }


@router.get("/db", status_code=status.HTTP_200_OK)
async def database_health_check(db: Session = Depends(get_db)):
    """
    Check database connectivity and responsiveness.
    
    Args:
        db: Database session
    
    Returns:
        Dictionary with database health status
    """
    try:
        # Execute simple query to test connection
        result = db.execute(text("SELECT 1 as health_check"))
        row = result.fetchone()
        
        if row and row[0] == 1:
            logger.debug("Database health check passed")
            return {
                "status": "healthy",
                "database": "connected",
                "message": "Database is responding correctly"
            }
        else:
            logger.warning("Database health check returned unexpected result")
            return {
                "status": "degraded",
                "database": "connected",
                "message": "Database connection exists but query returned unexpected result"
            }
    
    except Exception as error_instance:
        logger.error(f"Database health check failed: {str(error_instance)}")
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(error_instance)
        }


@router.get("/detailed", status_code=status.HTTP_200_OK)
async def detailed_health_check(db: Session = Depends(get_db)):
    """
    Detailed health check with component status.
    
    Args:
        db: Database session
    
    Returns:
        Dictionary with detailed component health
    """
    health_status = {
        "status": "healthy",
        "service": "mometric-requirements-api",
        "version": settings.app_version,
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.environment,
        "components": {}
    }
    
    # Check database
    try:
        db.execute(text("SELECT 1"))
        health_status["components"]["database"] = {
            "status": "healthy",
            "message": "PostgreSQL connected"
        }
    except Exception as error_instance:
        health_status["status"] = "degraded"
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(error_instance)
        }
    
    # Check AI configuration
    try:
        if settings.openai_api_key:
            health_status["components"]["openai"] = {
                "status": "configured",
                "model": settings.openai_model
            }
        else:
            health_status["status"] = "degraded"
            health_status["components"]["openai"] = {
                "status": "not_configured",
                "message": "OpenAI API key not set"
            }
    except Exception as error_instance:
        health_status["status"] = "degraded"
        health_status["components"]["openai"] = {
            "status": "error",
            "error": str(error_instance)
        }
    
    # Check Redis (if enabled)
    if settings.redis_enabled:
        health_status["components"]["redis"] = {
            "status": "configured",
            "url": settings.redis_url
        }
    else:
        health_status["components"]["redis"] = {
            "status": "disabled",
            "message": "Redis caching is not enabled"
        }
    
    return health_status


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(db: Session = Depends(get_db)):
    """
    Kubernetes readiness probe endpoint.
    Returns 200 if service is ready to accept traffic.
    
    Args:
        db: Database session
    
    Returns:
        Dictionary with readiness status
    """
    try:
        # Check database is accessible
        db.execute(text("SELECT 1"))
        
        # Check required configuration
        if not settings.openai_api_key:
            logger.warning("Readiness check: OpenAI API key not configured")
            return {
                "ready": False,
                "reason": "OpenAI API key not configured"
            }
        
        logger.debug("Readiness check passed")
        return {
            "ready": True,
            "message": "Service is ready to accept traffic"
        }
    
    except Exception as error_instance:
        logger.error(f"Readiness check failed: {str(error_instance)}")
        return {
            "ready": False,
            "reason": str(error_instance)
        }


@router.get("/live", status_code=status.HTTP_200_OK)
async def liveness_check():
    """
    Kubernetes liveness probe endpoint.
    Returns 200 if service is alive (doesn't check dependencies).
    
    Returns:
        Dictionary with liveness status
    """
    return {
        "alive": True,
        "timestamp": datetime.utcnow().isoformat()
    }
