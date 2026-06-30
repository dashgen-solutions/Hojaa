"""
Shared LLM configuration resolution for org integrations and platform keys.

Used by document AI chat, question generation, tree building, and other
agent-based features so Settings > AI keys are honored consistently.
"""
from typing import Any, Dict, Tuple

from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import Integration, IntegrationType, User

logger = get_logger(__name__)


def get_llm_config(db: DBSession, user: User) -> Tuple[str, Dict[str, Any]]:
    """
    Resolve the user's organization's LLM integration.

    Returns (provider, config_dict) where provider is 'openai', 'anthropic', or 'gemini'.
    Falls back to platform/env OpenAI key when no user integration is configured.
    Raises ValueError only when neither user nor platform key is available.
    """
    if user.organization_id:
        integrations = (
            db.query(Integration)
            .filter(
                Integration.organization_id == user.organization_id,
                Integration.integration_type.in_([
                    IntegrationType.LLM_OPENAI,
                    IntegrationType.LLM_ANTHROPIC,
                    IntegrationType.LLM_GEMINI,
                ]),
                Integration.is_active == True,
            )
            .all()
        )

        for integ in integrations:
            if integ.integration_type == IntegrationType.LLM_OPENAI:
                config = integ.config or {}
                if config.get("api_key"):
                    return ("openai", config)

        for integ in integrations:
            if integ.integration_type == IntegrationType.LLM_ANTHROPIC:
                config = integ.config or {}
                if config.get("api_key"):
                    return ("anthropic", config)

        for integ in integrations:
            if integ.integration_type == IntegrationType.LLM_GEMINI:
                config = integ.config or {}
                if config.get("api_key"):
                    return ("gemini", config)

    platform_key = (
        getattr(settings, "platform_openai_api_key", None)
        or settings.openai_api_key
        or ""
    )
    if platform_key:
        logger.info(f"Using platform API key for user {user.id} (no org integration)")
        return ("openai", {
            "api_key": platform_key,
            "model": settings.openai_model or "gpt-4o-mini",
        })

    raise ValueError(
        "No AI provider configured. Go to Settings > AI to add your API key."
    )


def model_from_llm_config(provider: str, config: Dict[str, Any]) -> Tuple[Any, str]:
    """
    Build a pydantic-ai Model from integration/platform config.

    Returns (model, model_name_for_logging).
    """
    if provider == "openai":
        model_name = config.get("model") or settings.openai_model or "gpt-4o-mini"
        import os
        os.environ["OPENAI_API_KEY"] = config["api_key"]
        return f"openai:{model_name}", f"openai:{model_name}"

    if provider == "anthropic":
        model_name = config.get("model") or settings.anthropic_model
        import os
        os.environ["ANTHROPIC_API_KEY"] = config["api_key"]
        return f"anthropic:{model_name}", f"anthropic:{model_name}"

    if provider == "gemini":
        raise ValueError(
            "Gemini is not supported for requirements generation yet. "
            "Add an OpenAI or Anthropic key in Settings > AI."
        )

    raise ValueError(f"Unknown AI provider: {provider}")
