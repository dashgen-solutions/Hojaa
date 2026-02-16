"""
RISK-2.3C — AI usage tracking and budget monitoring.

Logs every LLM call (tokens, model, cost) and provides query helpers
for the platform-admin dashboard.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.core.logger import get_logger
from app.models.database import AIUsageLog

logger = get_logger(__name__)

# ── Per-token pricing (USD) — updated 2025-Q4 ─────────────────
# Keep this dict current whenever model pricing changes.
_PRICING: Dict[str, Dict[str, float]] = {
    # OpenAI
    "openai:gpt-4o-mini":       {"prompt": 0.00015 / 1000, "completion": 0.0006 / 1000},
    "openai:gpt-4o":            {"prompt": 0.0025 / 1000,  "completion": 0.01 / 1000},
    "openai:gpt-4-turbo":       {"prompt": 0.01 / 1000,    "completion": 0.03 / 1000},
    "openai:gpt-3.5-turbo":     {"prompt": 0.0005 / 1000,  "completion": 0.0015 / 1000},
    # Anthropic
    "anthropic:claude-3-haiku-20240307":   {"prompt": 0.00025 / 1000, "completion": 0.00125 / 1000},
    "anthropic:claude-3-sonnet-20240229":  {"prompt": 0.003 / 1000,   "completion": 0.015 / 1000},
    "anthropic:claude-3-5-sonnet-20241022": {"prompt": 0.003 / 1000,  "completion": 0.015 / 1000},
}

# Fallback when model not in pricing table
_DEFAULT_PRICING = {"prompt": 0.002 / 1000, "completion": 0.006 / 1000}


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate cost in USD for a single LLM call."""
    pricing = _PRICING.get(model, _DEFAULT_PRICING)
    return (prompt_tokens * pricing["prompt"]) + (completion_tokens * pricing["completion"])


def log_usage(
    database: DBSession,
    *,
    task: str,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    duration_ms: int = 0,
    cache_hit: bool = False,
    session_id: Optional[UUID] = None,
    org_id: Optional[UUID] = None,
) -> None:
    """Persist a single AI usage record.  Fire-and-forget — errors are logged
    but never propagated so they don't break the main request.
    """
    try:
        cost = estimate_cost(model, prompt_tokens, completion_tokens)
        record = AIUsageLog(
            task=task,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens or (prompt_tokens + completion_tokens),
            estimated_cost_usd=cost,
            duration_ms=duration_ms,
            cache_hit=cache_hit,
            session_id=session_id,
            org_id=org_id,
        )
        database.add(record)
        database.commit()
        logger.debug(
            f"AI usage logged: task={task} model={model} "
            f"tokens={total_tokens} cost=${cost:.6f} cache_hit={cache_hit}"
        )
    except Exception as exc:
        database.rollback()
        logger.warning(f"Failed to log AI usage: {exc}")


# ── Query helpers (for /api/metrics/ai-usage) ──────────────────

def get_usage_summary(
    database: DBSession,
    *,
    days: int = 30,
    org_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """Return an aggregated usage summary for the platform admin dashboard."""
    since = datetime.utcnow() - timedelta(days=days)
    q = database.query(AIUsageLog).filter(AIUsageLog.created_at >= since)
    if org_id:
        q = q.filter(AIUsageLog.org_id == org_id)

    rows = q.all()
    if not rows:
        return {
            "period_days": days,
            "total_calls": 0,
            "cache_hits": 0,
            "total_tokens": 0,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "total_cost_usd": 0.0,
            "avg_cost_per_call": 0.0,
            "avg_tokens_per_call": 0,
            "by_task": {},
            "by_model": {},
            "daily": [],
        }

    total_calls = len(rows)
    cache_hits = sum(1 for r in rows if r.cache_hit)
    total_tokens = sum(r.total_tokens for r in rows)
    total_prompt = sum(r.prompt_tokens for r in rows)
    total_completion = sum(r.completion_tokens for r in rows)
    total_cost = sum(r.estimated_cost_usd for r in rows)

    # Aggregate by task
    by_task: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        t = by_task.setdefault(r.task, {"calls": 0, "tokens": 0, "cost_usd": 0.0, "cache_hits": 0})
        t["calls"] += 1
        t["tokens"] += r.total_tokens
        t["cost_usd"] += r.estimated_cost_usd
        if r.cache_hit:
            t["cache_hits"] += 1

    # Aggregate by model
    by_model: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        m = by_model.setdefault(r.model, {"calls": 0, "tokens": 0, "cost_usd": 0.0})
        m["calls"] += 1
        m["tokens"] += r.total_tokens
        m["cost_usd"] += r.estimated_cost_usd

    # Daily breakdown
    daily_map: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        day = r.created_at.strftime("%Y-%m-%d")
        d = daily_map.setdefault(day, {"date": day, "calls": 0, "tokens": 0, "cost_usd": 0.0})
        d["calls"] += 1
        d["tokens"] += r.total_tokens
        d["cost_usd"] += r.estimated_cost_usd
    daily = sorted(daily_map.values(), key=lambda x: x["date"])

    return {
        "period_days": days,
        "total_calls": total_calls,
        "cache_hits": cache_hits,
        "cache_hit_rate": round(cache_hits / total_calls, 3) if total_calls else 0,
        "total_tokens": total_tokens,
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_cost_usd": round(total_cost, 4),
        "avg_cost_per_call": round(total_cost / total_calls, 6) if total_calls else 0,
        "avg_tokens_per_call": round(total_tokens / total_calls) if total_calls else 0,
        "by_task": by_task,
        "by_model": by_model,
        "daily": daily,
    }
