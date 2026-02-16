"""
Agent service for type-safe LLM interactions using Pydantic AI.

Features:
- Per-task model selection (AI-4.3)
- Cost-tiered auto-upgrade (AI-4.4)
- Redis response caching (AI-4.5)
- Clean agent factory for multi-agent workflows
"""
import hashlib
import json
import os
from typing import TypeVar, Type, Optional
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models import Model
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

# Ensure API keys are available in environment for Pydantic AI
if settings.openai_api_key:
    os.environ["OPENAI_API_KEY"] = settings.openai_api_key
if settings.anthropic_api_key:
    os.environ["ANTHROPIC_API_KEY"] = settings.anthropic_api_key

# Type variable for generic agent creation
ResultType = TypeVar('ResultType', bound=BaseModel)

# ── Per-task model mapping (AI-4.3) ──────────────────────────────
# Maps logical task names → config field values.  Empty string == use global default.
_TASK_MODEL_MAP = {
    "tree_building":    lambda: settings.task_model_tree_building,
    "conversation":     lambda: settings.task_model_conversation,
    "question_gen":     lambda: settings.task_model_question_gen,
    "meeting_notes":    lambda: settings.task_model_meeting_notes,
    "scope_change":     lambda: settings.task_model_scope_change,
    "status_suggest":   lambda: settings.task_model_status_suggest,
    "ac_generate":      lambda: settings.task_model_ac_generate,
    "summary":          lambda: settings.task_model_summary,
    "export_structure":  lambda: settings.task_model_export_structure,
}

# ── Cost tiers (AI-4.4) ─────────────────────────────────────────
# "light" for small prompts, "standard" for most work, "heavy" for complex analysis.
_COST_TIER_MAP = {
    "light":    lambda: settings.cost_tier_light,
    "standard": lambda: settings.cost_tier_standard,
    "heavy":    lambda: settings.cost_tier_heavy,
}

# Default tier assignment per task (cheapest appropriate tier)
_TASK_DEFAULT_TIER = {
    "tree_building":    "standard",
    "conversation":     "light",
    "question_gen":     "light",
    "meeting_notes":    "standard",
    "scope_change":     "standard",
    "status_suggest":   "light",
    "ac_generate":      "light",
    "summary":          "standard",
    "export_structure":  "light",
}


def _resolve_model_name(task: Optional[str] = None) -> str:
    """
    Resolve the Pydantic-AI model string for a given task.

    Priority:
    1. Explicit per-task override in config (TASK_MODEL_xxx)
    2. First available model from the task's cost tier
    3. Global llm_provider default
    """
    # 1. Per-task override
    if task and task in _TASK_MODEL_MAP:
        override = _TASK_MODEL_MAP[task]()
        if override:
            return override

    # 2. Cost-tier selection — pick the first model whose provider has an API key
    tier_name = _TASK_DEFAULT_TIER.get(task, "standard") if task else "standard"
    tier_csv = _COST_TIER_MAP.get(tier_name, _COST_TIER_MAP["standard"])()
    for candidate in tier_csv.split(","):
        candidate = candidate.strip()
        if not candidate:
            continue
        provider = candidate.split(":")[0]
        if provider == "openai" and settings.openai_api_key:
            return candidate
        if provider == "anthropic" and settings.anthropic_api_key:
            return candidate

    # 3. Global fallback
    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        return f"anthropic:{settings.anthropic_model}"
    return f"openai:{settings.openai_model}"


def _estimate_tokens(text: str) -> int:
    """Rough token estimation (~4 chars/token for English)."""
    return max(1, len(text) // 4)


# ── Redis cache helpers (AI-4.5) ─────────────────────────────────

_redis_client = None


def _get_redis():
    """Lazy-init a Redis client (returns None if disabled / unavailable)."""
    global _redis_client
    if not settings.redis_enabled:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        import redis
        _redis_client = redis.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
        )
        _redis_client.ping()
        logger.info("Redis cache connected")
        return _redis_client
    except Exception as exc:
        logger.warning(f"Redis unavailable, caching disabled: {exc}")
        _redis_client = False          # sentinel — don't retry
        return None


def _cache_key(prompt: str, model: str) -> str:
    digest = hashlib.sha256(f"{model}::{prompt}".encode()).hexdigest()[:24]
    return f"{settings.cache_prefix}llm:{digest}"


async def cached_agent_run(
    agent: Agent,
    prompt: str,
    *,
    deps=None,
    model_name: str = "",
    cache_ttl: int = 0,
):
    """
    Run an agent with optional Redis response caching **and** timeout
    enforcement (PERF-1.2).

    If ``cache_ttl > 0`` **and** Redis is available, the serialised
    result is stored / reused.  Otherwise falls through to a normal run.
    AI calls are guarded by ``settings.ai_timeout_seconds`` via
    ``asyncio.wait_for``.
    """
    import asyncio
    r = _get_redis()
    key = _cache_key(prompt, model_name) if r and cache_ttl > 0 else ""

    # Cache hit?
    if key and r:
        try:
            cached = r.get(key)
            if cached:
                logger.debug("Cache hit for LLM prompt")
                # Return deserialised Pydantic model
                output_type = agent._output_type  # noqa: access private
                return type("CachedResult", (), {
                    "output": output_type.model_validate_json(cached),
                    "usage": lambda: "cached",
                })()
        except Exception:
            pass  # cache miss — continue

    timeout = settings.ai_timeout_seconds
    try:
        result = await asyncio.wait_for(
            agent.run(prompt, deps=deps),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        logger.error(f"AI agent call timed out after {timeout}s")
        raise TimeoutError(f"AI processing exceeded {timeout}s limit")

    # Store
    if key and r and cache_ttl > 0:
        try:
            r.setex(key, cache_ttl, result.output.model_dump_json())
        except Exception:
            pass

    return result


class AIService:
    """
    Service for creating and managing Pydantic AI agents.

    Supports:
    - Per-task model selection (AI-4.3)
    - Cost-tier auto-selection (AI-4.4)
    - Redis response caching (AI-4.5 — via ``cached_agent_run``)
    """
    
    def __init__(self):
        """Initialize AI service with configured LLM provider."""
        self.default_model = _resolve_model_name()
        logger.info(f"Initialized AI Service – default model: {self.default_model}")
        
        # Debug: show masked API key
        api_key = settings.openai_api_key
        if api_key and len(api_key) > 8:
            masked_key = f"{api_key[:4]}...{api_key[-4:]}"
        else:
            masked_key = "INVALID_OR_TOO_SHORT"
        logger.info(f"OpenAI API Key loaded: {masked_key}")
    
    def _get_model_name(self, task: Optional[str] = None) -> str:
        """
        Get the Pydantic-AI model string, optionally scoped to a task.
        """
        return _resolve_model_name(task)
    
    def create_agent(
        self,
        system_prompt: str,
        output_type: Type[ResultType],
        deps_type: Type = None,
        retries: int = 2,
        task: Optional[str] = None,
    ) -> Agent[None, ResultType]:
        """
        Create a new Pydantic AI agent with structured output.
        
        Args:
            system_prompt: System prompt defining agent behavior
            output_type: Pydantic model for structured output validation
            deps_type: Optional dependency type for dependency injection
            retries: Number of retries on validation failure (default: 2)
            task: Logical task name for per-task model selection (AI-4.3)
        
        Returns:
            Configured Pydantic AI Agent
        """
        model = self._get_model_name(task)
        agent = Agent(
            model,
            output_type=output_type,
            deps_type=deps_type,
            retries=retries,
            system_prompt=system_prompt
        )
        
        logger.info(f"Created agent with output_type={output_type.__name__}")
        return agent
    
    def create_streaming_agent(
        self,
        system_prompt: str,
        deps_type: Type = None,
        task: Optional[str] = None,
    ) -> Agent[None, str]:
        """
        Create an agent for streaming text responses.
        
        Args:
            system_prompt: System prompt defining agent behavior
            deps_type: Optional dependency type for context
            task: Logical task name for per-task model selection
        
        Returns:
            Agent configured for text streaming
        """
        model = self._get_model_name(task)
        agent = Agent(
            model,
            deps_type=deps_type,
            system_prompt=system_prompt
        )
        
        logger.info("Created streaming agent")
        return agent
    
    def get_model_settings(self, temperature: float = None) -> dict:
        """
        Get model-specific settings for fine-tuning.
        
        Args:
            temperature: Override default temperature (0.0-2.0)
        
        Returns:
            Dictionary of model settings
        """
        if settings.llm_provider == "openai":
            from pydantic_ai.models.openai import OpenAIModelSettings
            return {
                "temperature": temperature or settings.openai_temperature,
            }
        elif settings.llm_provider == "anthropic":
            from pydantic_ai.models.anthropic import AnthropicModelSettings
            return {
                "temperature": temperature or 0.7,
            }
        return {}


# Global agent service instance
agent_service = AIService()


# ===== Convenience Functions for Common Patterns =====

def create_requirements_agent(
    system_prompt: str,
    output_type: Type[ResultType],
    deps_type: Type = None,
    task: Optional[str] = None,
) -> Agent[None, ResultType]:
    """
    Create an agent specialized for requirements discovery.
    Uses optimized settings for structured requirement extraction.
    
    Args:
        system_prompt: Requirements-specific system prompt
        output_type: Pydantic model for output structure
        deps_type: Optional dependency type for context injection
        task: Logical task name for per-task model selection
    
    Returns:
        Configured agent for requirements tasks
    """
    return agent_service.create_agent(
        system_prompt=system_prompt,
        output_type=output_type,
        deps_type=deps_type,
        retries=3,
        task=task,
    )


def create_conversation_agent(
    system_prompt: str,
    output_type: Type[ResultType],
    deps_type: Type = None,
    task: Optional[str] = None,
) -> Agent:
    """
    Create an agent for conversational interactions.
    Optimized for natural dialogue flow.
    
    Args:
        system_prompt: Conversation-specific system prompt
        output_type: Pydantic model for structured conversation output
        deps_type: Context dependencies for the conversation
        task: Logical task name for per-task model selection
    
    Returns:
        Configured agent for conversations
    """
    return agent_service.create_agent(
        system_prompt=system_prompt,
        output_type=output_type,
        deps_type=deps_type,
        retries=2,
        task=task,
    )
