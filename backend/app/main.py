"""
Main FastAPI application.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logger import get_logger, configure_logging
from app.db.session import init_db
from app.api.routes import (
    upload,
    questions,
    chat,
    tree,
    sessions,
    auth,
    health,
    question_management,
    node_management,
    transcription,
    sources,
    audit,
    planning,
    export,
    notifications,
    metrics,
    websocket,
    integrations,
    branding,
    api_keys,
    session_chat,
    messaging,
    documents,
)
from app.models.schemas import HealthResponse
from app.middleware.metrics import MetricsMiddleware
from app.middleware.security import (
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    CSRFMiddleware,
)
from app.services.websocket_manager import ws_manager

# Configure logging
configure_logging()
logger = get_logger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered requirements discovery system with progressive questioning",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# ── Middleware stack (outermost → innermost) ──
# Order matters: first added = outermost wrapper
app.add_middleware(SecurityHeadersMiddleware)   # SEC-2.7 — XSS / clickjack headers
app.add_middleware(RateLimitMiddleware)          # SEC-2.5 — rate limiting
app.add_middleware(CSRFMiddleware)               # SEC-2.8 — CSRF origin check
app.add_middleware(MetricsMiddleware)            # PERF-1.1 — latency tracking

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api")  # Health checks
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(upload.router, prefix="/api")
app.include_router(questions.router, prefix="/api")
app.include_router(question_management.router, prefix="/api/manage")  # Question management
app.include_router(chat.router, prefix="/api")
app.include_router(tree.router, prefix="/api")
app.include_router(node_management.router, prefix="/api/manage")  # Node management
app.include_router(sessions.router, prefix="/api")
app.include_router(transcription.router, prefix="/api")  # Audio transcription
app.include_router(sources.router, prefix="/api")  # Source ingestion (Phase 1)
app.include_router(audit.router, prefix="/api")  # Audit trail & node status (Phase 2/3)
app.include_router(planning.router, prefix="/api")  # Planning board (Phase 4)
app.include_router(export.router, prefix="/api")  # Export (Phase 5)
app.include_router(notifications.router, prefix="/api")  # Email notifications (Mailchimp)
app.include_router(metrics.router, prefix="/api")  # Success metrics dashboard (Section 19)
app.include_router(websocket.router, prefix="/api")  # 18.2-A: Real-time collaboration (WebSocket)
app.include_router(integrations.router, prefix="/api")  # 18.2-B: External integrations (Jira, Slack)
app.include_router(branding.router, prefix="/api")  # 18.2-C: White-labeling / branding
app.include_router(api_keys.router, prefix="/api")  # 18.2-D: Public API — API key management
app.include_router(session_chat.router, prefix="/api")  # Session AI Chatbot (Command Center)
app.include_router(messaging.router, prefix="/api")  # Global Messaging ("Mini Slack")
app.include_router(documents.router, prefix="/api")  # Documents (PandaDoc replacement)


@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"LLM Provider: {settings.llm_provider}")
    
    # Initialize database
    try:
        init_db()
        app.state.db_ready = True
        logger.info("Database initialized successfully")
        
        # Start WebSocket presence cleanup loop
        await ws_manager.start_cleanup_loop()
        logger.info("WebSocket presence cleanup loop started")
    except Exception as e:
        app.state.db_ready = False
        logger.error(f"Database initialization failed: {str(e)}")
        # Don't crash the entire API if the DB isn't ready (e.g. Postgres not installed,
        # database not created yet). Endpoints that need the DB will still fail until
        # DATABASE_URL is fixed, but /api/docs and basic health can still load.
        logger.warning(
            "Continuing startup WITHOUT a working database. "
            "Fix DATABASE_URL / create the database and restart the server."
        )


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    ws_manager.stop_cleanup_loop()
    logger.info("Shutting down application")


@app.get("/", tags=["root"])
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to Hojaa API",
        "version": settings.app_version,
        "docs": "/api/docs"
    }


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        environment=settings.environment,
        database="connected" if getattr(app.state, "db_ready", False) else "unavailable"
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if settings.debug else "An unexpected error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
