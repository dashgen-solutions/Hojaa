"""
Database session management and configuration.
"""
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.engine.url import make_url
import os
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

# Create database engine
#
# SQLite needs special handling:
# - pool_size/max_overflow are not meaningful for StaticPool
# - check_same_thread must be disabled for multi-threaded ASGI servers
if settings.database_url.startswith("sqlite"):
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=settings.debug,
    )
else:
    engine = create_engine(
        settings.database_url,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        echo=settings.debug,
    )

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency to get database session.
    
    Yields:
        Database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database tables and run pending Alembic migrations."""
    logger.info("Initializing database tables")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
        _run_alembic_migrations()
        return
    except OperationalError as e:
        # If we're using Postgres and the database doesn't exist yet, optionally
        # auto-create it (common local dev setup).
        auto_create = os.getenv("MOMETRIC_AUTO_CREATE_DB", "1") == "1"
        db_url = settings.database_url
        if (
            auto_create
            and "does not exist" in str(e).lower()
            and (db_url.startswith("postgresql://") or db_url.startswith("postgres://"))
        ):
            url = make_url(db_url)
            target_db = url.database
            if not target_db:
                raise

            logger.warning(f"Database '{target_db}' does not exist. Attempting to create it...")

            # Connect to a server-level database to run CREATE DATABASE.
            server_url = url.set(database="postgres")
            admin_engine = create_engine(server_url, isolation_level="AUTOCOMMIT")
            try:
                with admin_engine.connect() as conn:
                    conn.execute(text(f'CREATE DATABASE "{target_db}"'))
                logger.info(f"Created database '{target_db}' successfully")
            except OperationalError as create_err:
                # If it was created concurrently or already exists, proceed.
                if "already exists" not in str(create_err).lower():
                    logger.error(f"Failed to create database '{target_db}': {create_err}")
                    raise
            finally:
                admin_engine.dispose()

            # Retry table creation now that the DB exists.
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables created successfully")
            _run_alembic_migrations()
            return

        # Anything else: re-raise so caller can handle/log.
        raise


def _run_alembic_migrations() -> None:
    """Stamp or upgrade the Alembic migration head so future migrations apply cleanly."""
    try:
        from alembic.config import Config
        from alembic import command
        from alembic.runtime.migration import MigrationContext

        alembic_cfg = Config("alembic.ini")

        # Check current revision
        with engine.connect() as conn:
            ctx = MigrationContext.configure(conn)
            current_rev = ctx.get_current_revision()

        if current_rev is None:
            # Fresh DB (created via create_all) — stamp to head so Alembic knows
            # the schema is already up-to-date
            logger.info("Stamping Alembic migration head (fresh database)")
            command.stamp(alembic_cfg, "head")
        else:
            # DB already has revision — run any pending upgrades
            logger.info(f"Current Alembic revision: {current_rev}. Running pending migrations...")
            command.upgrade(alembic_cfg, "head")
            logger.info("Alembic migrations applied successfully")

    except Exception as e:
        # Non-fatal — don't break startup if alembic.ini is missing (e.g. dev mode)
        logger.warning(f"Alembic migration step skipped: {e}")
