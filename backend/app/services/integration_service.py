"""
18.2-B  External Integrations — Jira & Slack service layer.

Provides:
- **Jira**: Create issues from cards/nodes, sync status bi-directionally.
- **Slack**: Post session summaries, node change notifications, card assignment alerts.

All calls are fire-and-forget with audit logging in ``integration_syncs``.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.models.database import (
    APIKey,
    Card,
    Integration,
    IntegrationSync,
    IntegrationType,
    Node,
)

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════════
#  Generic helpers
# ═══════════════════════════════════════════════════════════════

def _log_sync(
    db: Session,
    integration_id: UUID,
    action: str,
    *,
    session_id: Optional[UUID] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    external_id: Optional[str] = None,
    external_url: Optional[str] = None,
    status: str = "success",
    error_message: Optional[str] = None,
) -> None:
    """Persist an integration sync audit row."""
    db.add(IntegrationSync(
        integration_id=integration_id,
        session_id=session_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        external_id=external_id,
        external_url=external_url,
        status=status,
        error_message=error_message,
    ))
    db.commit()


def get_integration(
    db: Session,
    org_id: UUID,
    integration_type: IntegrationType,
) -> Optional[Integration]:
    """Return the active integration for an org, or None."""
    return (
        db.query(Integration)
        .filter_by(organization_id=org_id, integration_type=integration_type, is_active=True)
        .first()
    )


# ═══════════════════════════════════════════════════════════════
#  JIRA
# ═══════════════════════════════════════════════════════════════

_PRIORITY_MAP = {
    "critical": "Highest",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
}


async def jira_create_issue(
    db: Session,
    integration: Integration,
    *,
    summary: str,
    description: str = "",
    issue_type: str = "Story",
    priority: str = "medium",
    labels: Optional[List[str]] = None,
    session_id: Optional[UUID] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
) -> Optional[Dict[str, Any]]:
    """Create a Jira issue via the REST v3 API.

    Config keys expected:
    - ``base_url``   — e.g. ``https://company.atlassian.net``
    - ``email``      — Atlassian account email
    - ``api_token``  — API token (not password)
    - ``project_key``— Jira project key (e.g. ``REQ``)
    """
    cfg = integration.config or {}
    base_url = cfg.get("base_url", "").rstrip("/")
    email = cfg.get("email", "")
    api_token = cfg.get("api_token", "")
    project_key = cfg.get("project_key", "")

    if not all([base_url, email, api_token, project_key]):
        _log_sync(db, integration.id, "create_issue", status="failed",
                  error_message="Missing Jira config fields", session_id=session_id)
        return None

    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": summary,
            "description": {
                "type": "doc",
                "version": 1,
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": description or summary}]}],
            },
            "issuetype": {"name": issue_type},
            "priority": {"name": _PRIORITY_MAP.get(priority, "Medium")},
        }
    }
    if labels:
        payload["fields"]["labels"] = labels

    url = f"{base_url}/rest/api/3/issue"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                json=payload,
                auth=(email, api_token),
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

            issue_key = data.get("key", "")
            issue_url = f"{base_url}/browse/{issue_key}"

            _log_sync(
                db, integration.id, "create_issue",
                session_id=session_id,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else None,
                external_id=issue_key,
                external_url=issue_url,
            )
            logger.info(f"Jira issue created: {issue_key}")
            return {"key": issue_key, "url": issue_url, "id": data.get("id")}

    except Exception as e:
        _log_sync(
            db, integration.id, "create_issue",
            status="failed", error_message=str(e),
            session_id=session_id,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
        )
        logger.error(f"Jira create_issue failed: {e}")
        return None


async def jira_transition_issue(
    db: Session,
    integration: Integration,
    issue_key: str,
    target_status: str,
) -> bool:
    """Transition a Jira issue to a new status (e.g. 'Done')."""
    cfg = integration.config or {}
    base_url = cfg.get("base_url", "").rstrip("/")
    email = cfg.get("email", "")
    api_token = cfg.get("api_token", "")

    if not all([base_url, email, api_token]):
        return False

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Get available transitions
            resp = await client.get(
                f"{base_url}/rest/api/3/issue/{issue_key}/transitions",
                auth=(email, api_token),
            )
            resp.raise_for_status()
            transitions = resp.json().get("transitions", [])
            target = next(
                (t for t in transitions if t["name"].lower() == target_status.lower()),
                None,
            )
            if not target:
                return False

            # Execute transition
            resp = await client.post(
                f"{base_url}/rest/api/3/issue/{issue_key}/transitions",
                json={"transition": {"id": target["id"]}},
                auth=(email, api_token),
            )
            resp.raise_for_status()

            _log_sync(db, integration.id, "transition_issue", external_id=issue_key)
            return True
    except Exception as e:
        _log_sync(db, integration.id, "transition_issue", status="failed", error_message=str(e))
        logger.error(f"Jira transition failed: {e}")
        return False


# ═══════════════════════════════════════════════════════════════
#  SLACK
# ═══════════════════════════════════════════════════════════════

async def slack_send_message(
    db: Session,
    integration: Integration,
    *,
    text: str,
    blocks: Optional[List[dict]] = None,
    channel: Optional[str] = None,
    session_id: Optional[UUID] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
) -> Optional[str]:
    """Post a message to Slack via Bot Token or Incoming Webhook.

    Config keys:
    - ``webhook_url``  — Incoming Webhook URL (simplest integration)
    - ``bot_token``    — Bot User OAuth Token (for chat.postMessage)
    - ``channel_id``   — Default channel to post to
    """
    cfg = integration.config or {}
    webhook_url = cfg.get("webhook_url", "")
    bot_token = cfg.get("bot_token", "")
    default_channel = channel or cfg.get("channel_id", "")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if webhook_url:
                # Incoming Webhook (simplest)
                payload: Dict[str, Any] = {"text": text}
                if blocks:
                    payload["blocks"] = blocks
                resp = await client.post(webhook_url, json=payload)
                resp.raise_for_status()
                _log_sync(
                    db, integration.id, "send_message",
                    session_id=session_id,
                    entity_type=entity_type,
                    entity_id=str(entity_id) if entity_id else None,
                )
                return "ok"

            elif bot_token and default_channel:
                payload = {
                    "channel": default_channel,
                    "text": text,
                }
                if blocks:
                    payload["blocks"] = blocks
                resp = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    json=payload,
                    headers={"Authorization": f"Bearer {bot_token}"},
                )
                resp.raise_for_status()
                data = resp.json()
                ts = data.get("ts", "")
                _log_sync(
                    db, integration.id, "send_message",
                    session_id=session_id,
                    entity_type=entity_type,
                    entity_id=str(entity_id) if entity_id else None,
                    external_id=ts,
                )
                return ts
            else:
                _log_sync(
                    db, integration.id, "send_message",
                    status="failed", error_message="No webhook_url or bot_token configured",
                )
                return None

    except Exception as e:
        _log_sync(
            db, integration.id, "send_message",
            status="failed", error_message=str(e),
            session_id=session_id,
        )
        logger.error(f"Slack send_message failed: {e}")
        return None


async def slack_notify_node_change(
    db: Session,
    integration: Integration,
    *,
    session_name: str,
    node_title: str,
    change_type: str,
    changed_by: str,
    session_id: Optional[UUID] = None,
) -> Optional[str]:
    """Send a rich Slack notification for a node change."""
    emoji = {"created": "🆕", "modified": "✏️", "deleted": "🗑️", "status_changed": "🔄"}.get(change_type, "📝")

    text = f"{emoji} *{change_type.replace('_', ' ').title()}*: {node_title}\n" \
           f"Session: {session_name} | By: {changed_by}"

    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": text},
        },
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"📅 {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"},
            ],
        },
    ]

    return await slack_send_message(
        db, integration, text=text, blocks=blocks,
        session_id=session_id, entity_type="node",
    )


async def slack_notify_card_assignment(
    db: Session,
    integration: Integration,
    *,
    card_title: str,
    assignee_name: str,
    assigner_name: str,
    session_id: Optional[UUID] = None,
) -> Optional[str]:
    """Notify Slack when a card is assigned."""
    text = f"📋 *Card Assigned*: {card_title}\n" \
           f"Assigned to: {assignee_name} | By: {assigner_name}"

    return await slack_send_message(
        db, integration, text=text,
        session_id=session_id, entity_type="card",
    )


# ═══════════════════════════════════════════════════════════════
#  Bulk: Export session to Jira
# ═══════════════════════════════════════════════════════════════

async def export_cards_to_jira(
    db: Session,
    integration: Integration,
    cards: List[Card],
    session_id: UUID,
) -> Dict[str, Any]:
    """Export a batch of planning cards as Jira issues."""
    results = {"created": 0, "failed": 0, "issues": []}

    for card in cards:
        title = card.title or (card.node.question if card.node else "Untitled")
        desc = card.description or ""
        if card.node and card.node.answer:
            desc += f"\n\nAnswer: {card.node.answer}"

        result = await jira_create_issue(
            db, integration,
            summary=title,
            description=desc,
            priority=card.priority.value if card.priority else "medium",
            labels=["hojaa"],
            session_id=session_id,
            entity_type="card",
            entity_id=card.id,
        )
        if result:
            results["created"] += 1
            results["issues"].append(result)
        else:
            results["failed"] += 1

    return results
