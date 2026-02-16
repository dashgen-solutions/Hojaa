"""
Application configuration management using Pydantic Settings.
"""
from typing import Dict, List, Optional
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


def _get_env_file() -> Optional[str]:
    """
    Return an absolute path to a readable .env file, or None.

    In some environments (sandboxed terminals / restricted FS), attempting to read
    a gitignored `.env` can raise PermissionError / OSError. We treat that as
    "no env file" so the app can still boot using process environment variables
    and defaults.
    """
    env_path = Path(__file__).resolve().parents[2] / ".env"  # backend/.env
    try:
        if not env_path.is_file():
            return None
        # Validate readability explicitly (can raise PermissionError).
        with open(env_path, "rb"):
            pass
        return str(env_path)
    except OSError:
        return None


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    app_name: str = Field(default="MoMetric Requirements Discovery API", alias="APP_NAME")
    app_version: str = Field(default="1.0.0", alias="APP_VERSION")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=True, alias="DEBUG")
    
    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    
    # Database
    # Defaults to a local sqlite DB so dev can start without external services.
    database_url: str = Field(default="sqlite:///./mometric.db", alias="DATABASE_URL")
    database_pool_size: int = Field(default=10, alias="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=20, alias="DATABASE_MAX_OVERFLOW")
    
    # OpenAI
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")
    openai_temperature: float = Field(default=0.7, alias="OPENAI_TEMPERATURE")
    
    # Anthropic
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(default="claude-3-sonnet-20240229", alias="ANTHROPIC_MODEL")
    
    # LLM Provider
    llm_provider: str = Field(default="openai", alias="LLM_PROVIDER")

    # ── Per-task model overrides (AI-4.3) ──
    # Keys: tree_building, conversation, question_gen, meeting_notes,
    #        scope_change, status_suggest, ac_generate, summary, export_structure
    # Value format: "provider:model" e.g. "openai:gpt-4o-mini" or "anthropic:claude-3-haiku-20240307"
    # Empty string → fall back to the global llm_provider + default model.
    task_model_tree_building: str = Field(default="", alias="TASK_MODEL_TREE_BUILDING")
    task_model_conversation: str = Field(default="", alias="TASK_MODEL_CONVERSATION")
    task_model_question_gen: str = Field(default="", alias="TASK_MODEL_QUESTION_GEN")
    task_model_meeting_notes: str = Field(default="", alias="TASK_MODEL_MEETING_NOTES")
    task_model_scope_change: str = Field(default="", alias="TASK_MODEL_SCOPE_CHANGE")
    task_model_status_suggest: str = Field(default="", alias="TASK_MODEL_STATUS_SUGGEST")
    task_model_ac_generate: str = Field(default="", alias="TASK_MODEL_AC_GENERATE")
    task_model_summary: str = Field(default="", alias="TASK_MODEL_SUMMARY")
    task_model_export_structure: str = Field(default="", alias="TASK_MODEL_EXPORT_STRUCTURE")

    # ── Cost optimisation (AI-4.4) ──
    # Tiered model lists — agent_service picks cheapest tier that fits the prompt.
    # Format: comma-separated "provider:model" strings, ordered cheapest→most-capable.
    cost_tier_light: str = Field(
        default="openai:gpt-4o-mini,anthropic:claude-3-haiku-20240307",
        alias="COST_TIER_LIGHT",
    )
    cost_tier_standard: str = Field(
        default="openai:gpt-4o,anthropic:claude-3-sonnet-20240229",
        alias="COST_TIER_STANDARD",
    )
    cost_tier_heavy: str = Field(
        default="openai:gpt-4o,anthropic:claude-3-5-sonnet-20241022",
        alias="COST_TIER_HEAVY",
    )
    # Max prompt tokens before auto-upgrading to a heavier tier
    cost_auto_upgrade_token_threshold: int = Field(default=4000, alias="COST_AUTO_UPGRADE_TOKEN_THRESHOLD")

    # ── Response caching (AI-4.5) ──
    cache_ttl_seconds: int = Field(default=3600, alias="CACHE_TTL_SECONDS")
    cache_prefix: str = Field(default="mometric:", alias="CACHE_PREFIX")

    # ── Timeout enforcement (PERF-1.2 / 1.3) ──
    ai_timeout_seconds: float = Field(default=30.0, alias="AI_TIMEOUT_SECONDS")
    pdf_timeout_seconds: float = Field(default=15.0, alias="PDF_TIMEOUT_SECONDS")
    default_request_timeout_seconds: float = Field(default=60.0, alias="DEFAULT_REQUEST_TIMEOUT_SECONDS")

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    redis_enabled: bool = Field(default=False, alias="REDIS_ENABLED")
    
    # CORS
    cors_origins: List[str] = Field(
        default=["http://localhost:3000"],
        alias="CORS_ORIGINS"
    )
    cors_allow_credentials: bool = Field(default=True, alias="CORS_ALLOW_CREDENTIALS")
    
    # File Upload
    max_file_size_mb: int = Field(default=10, alias="MAX_FILE_SIZE_MB")
    allowed_file_types: List[str] = Field(
        default=[".pdf", ".doc", ".docx", ".txt"],
        alias="ALLOWED_FILE_TYPES"
    )
    
    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: str = Field(default="json", alias="LOG_FORMAT")
    
    # Mailchimp (notifications: node changes, source ingested, card assignment)
    mailchimp_api_key: str = Field(default="", alias="MAILCHIMP_API_KEY")
    mailchimp_server_prefix: str = Field(default="", alias="MAILCHIMP_SERVER_PREFIX")
    mailchimp_audience_id: str = Field(default="", alias="MAILCHIMP_AUDIENCE_ID")  # Audience/List ID from Mailchimp → Audience → Settings
    mailchimp_from_email: str = Field(default="notifications@mometric.app", alias="MAILCHIMP_FROM_EMAIL")
    mailchimp_from_name: str = Field(default="MoMetric", alias="MAILCHIMP_FROM_NAME")
    mailchimp_enabled: bool = Field(default=False, alias="MAILCHIMP_ENABLED")
    
    # Security
    secret_key: str = Field(default="dev-secret-change-me", alias="SECRET_KEY")
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    access_token_expire_minutes: int = Field(default=30, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    
    model_config = SettingsConfigDict(
        env_file=_get_env_file(),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024


# Global settings instance
settings = Settings()
