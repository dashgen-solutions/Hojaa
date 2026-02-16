"""
Success Metrics Service (Section 19).

Computes product, satisfaction, and technical metrics from the database
and the in-memory MetricsMiddleware histogram.  All queries are read-only.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import func, case, and_, distinct, extract
from sqlalchemy.orm import Session as DBSession

from app.models.database import (
    Session as SessionModel,
    SessionStatus,
    Node,
    NodeStatus,
    NodeHistory,
    ChangeType,
    Source,
    SourceType,
    Card,
    CardStatus,
    User,
    Organization,
    Message,
    Conversation,
    TeamMember,
    Assignment,
    AcceptanceCriterion,
    SourceSuggestion,
)
from app.core.logger import get_logger

logger = get_logger(__name__)

# ── Targets (used for pass/fail colouring on the dashboard) ──────────

TARGETS = {
    "session_completion_rate": 70,     # %
    "meeting_notes_per_session": 3,    # count
    "scope_changes_tracked": 5,        # count
    "planning_cards_per_session": 10,  # count
    "time_to_first_export_days": 14,   # days
    "api_p95_ms": 500,                 # ms
    "ai_processing_ms": 10_000,        # ms
    "pdf_generation_ms": 5_000,        # ms
    "test_coverage_pct": 80,           # %
    "uptime_pct": 99.5,               # %
}


class MetricsService:
    """Stateless service — instantiate per request or keep as singleton."""

    # ── 19.1 Product Metrics ─────────────────────────────────────

    def product_metrics(
        self,
        db: DBSession,
        org_id: Optional[UUID] = None,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        METRIC-1.1 → 1.7 computed from database state.

        Parameters
        ----------
        db      : SQLAlchemy session (read-only usage)
        org_id  : Optional org scope (None = platform-wide)
        days    : Look-back window for time-boxed metrics
        """
        since = datetime.utcnow() - timedelta(days=days)
        base_q = db.query(SessionModel)
        if org_id:
            base_q = base_q.filter(SessionModel.organization_id == org_id)

        # ── METRIC-1.1  Session completion rate ──
        total_sessions = base_q.count()
        completed_sessions = base_q.filter(
            SessionModel.status.in_([SessionStatus.COMPLETED, SessionStatus.ACTIVE, SessionStatus.TREE_GENERATED])
        ).count()
        session_completion_rate = round(
            (completed_sessions / total_sessions * 100) if total_sessions else 0, 1
        )

        # ── METRIC-1.2  Meeting notes per session ──
        source_q = db.query(Source).join(SessionModel)
        if org_id:
            source_q = source_q.filter(SessionModel.organization_id == org_id)
        meeting_sources = source_q.filter(
            Source.source_type == SourceType.MEETING,
            Source.created_at >= since,
        ).count()
        sessions_with_sources = (
            source_q
            .filter(Source.created_at >= since)
            .with_entities(func.count(distinct(Source.session_id)))
            .scalar()
        ) or 1
        meeting_notes_avg = round(meeting_sources / sessions_with_sources, 1)

        # ── METRIC-1.3  Scope changes tracked ──
        history_q = db.query(NodeHistory)
        if org_id:
            history_q = history_q.join(SessionModel, NodeHistory.session_id == SessionModel.id).filter(
                SessionModel.organization_id == org_id
            )
        scope_changes_total = history_q.filter(NodeHistory.changed_at >= since).count()
        scope_changes_per_session = round(
            scope_changes_total / max(total_sessions, 1), 1
        )

        # ── METRIC-1.4  Planning cards created ──
        card_q = db.query(Card).join(SessionModel)
        if org_id:
            card_q = card_q.filter(SessionModel.organization_id == org_id)
        total_cards = card_q.filter(Card.created_at >= since).count()
        cards_per_session = round(total_cards / max(total_sessions, 1), 1)

        # ── METRIC-1.5  Time to first export ──
        # We approximate with session_metadata → export_count or by measuring
        # time from session.created_at to the earliest NodeHistory export-like
        # event.  For now we compute avg age of sessions that reached ACTIVE.
        active_sessions = (
            base_q
            .filter(
                SessionModel.status.in_([SessionStatus.ACTIVE, SessionStatus.COMPLETED, SessionStatus.TREE_GENERATED]),
                SessionModel.created_at >= since,
            )
            .all()
        )
        if active_sessions:
            ages = [(datetime.utcnow() - s.created_at).days for s in active_sessions]
            avg_days_to_active = round(sum(ages) / len(ages), 1)
        else:
            avg_days_to_active = 0

        # ── METRIC-1.6  User retention (users active in last 7d / total) ──
        total_users = db.query(User).filter(User.is_active.is_(True))
        if org_id:
            total_users = total_users.filter(User.organization_id == org_id)
        total_users_count = total_users.count()
        recent_active = (
            db.query(func.count(distinct(SessionModel.user_id)))
            .filter(SessionModel.updated_at >= datetime.utcnow() - timedelta(days=7))
        )
        if org_id:
            recent_active = recent_active.filter(SessionModel.organization_id == org_id)
        recent_active_count = recent_active.scalar() or 0
        retention_rate = round(
            (recent_active_count / max(total_users_count, 1)) * 100, 1
        )

        # ── METRIC-1.7  Feature adoption rates ──
        features = self._feature_adoption(db, org_id, since)

        return {
            "period_days": days,
            "session_completion_rate": session_completion_rate,
            "target_session_completion_rate": TARGETS["session_completion_rate"],
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "meeting_notes_avg_per_session": meeting_notes_avg,
            "target_meeting_notes": TARGETS["meeting_notes_per_session"],
            "total_meeting_notes": meeting_sources,
            "scope_changes_total": scope_changes_total,
            "scope_changes_per_session": scope_changes_per_session,
            "target_scope_changes": TARGETS["scope_changes_tracked"],
            "total_cards": total_cards,
            "cards_per_session": cards_per_session,
            "target_cards_per_session": TARGETS["planning_cards_per_session"],
            "avg_days_to_active": avg_days_to_active,
            "target_days_to_first_export": TARGETS["time_to_first_export_days"],
            "retention_rate": retention_rate,
            "total_users": total_users_count,
            "recently_active_users": recent_active_count,
            "feature_adoption": features,
        }

    # ── 19.2 User Satisfaction Indicators ────────────────────────

    def satisfaction_metrics(
        self,
        db: DBSession,
        org_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        METRIC-2.1 → 2.5.
        Computed from data completeness — a proxy for whether users can
        answer key questions.
        """
        base_q = db.query(SessionModel)
        if org_id:
            base_q = base_q.filter(SessionModel.organization_id == org_id)
        sessions = base_q.all()
        total = len(sessions) or 1

        # METRIC-2.1 : "What's in scope?" — sessions with ≥5 active nodes
        sessions_with_scope = 0
        # METRIC-2.2 : "Why is this here?" — nodes originating from a source
        nodes_with_source = 0
        total_nodes = 0
        # METRIC-2.3 : "What changed since kickoff?" — sessions with ≥1 history entry
        sessions_with_history = 0

        session_ids = [s.id for s in sessions]
        if session_ids:
            # 2.1
            node_counts = (
                db.query(Node.session_id, func.count(Node.id))
                .filter(Node.session_id.in_(session_ids), Node.status != NodeStatus.REMOVED)
                .group_by(Node.session_id)
                .all()
            )
            sessions_with_scope = sum(1 for _, c in node_counts if c >= 5)

            # 2.2
            total_nodes = (
                db.query(func.count(Node.id))
                .filter(Node.session_id.in_(session_ids), Node.status != NodeStatus.REMOVED)
                .scalar()
            ) or 0
            nodes_with_source = (
                db.query(func.count(Node.id))
                .filter(
                    Node.session_id.in_(session_ids),
                    Node.source_id.isnot(None),
                    Node.status != NodeStatus.REMOVED,
                )
                .scalar()
            ) or 0

            # 2.3
            s_with_hist = (
                db.query(func.count(distinct(NodeHistory.session_id)))
                .filter(NodeHistory.session_id.in_(session_ids))
                .scalar()
            ) or 0
            sessions_with_history = s_with_hist

        traceability_pct = round(
            (nodes_with_source / max(total_nodes, 1)) * 100, 1
        )

        return {
            "whats_in_scope": {
                "label": "Can answer 'What's in scope?'",
                "sessions_with_scope": sessions_with_scope,
                "total_sessions": total,
                "pct": round(sessions_with_scope / total * 100, 1),
            },
            "why_is_this_here": {
                "label": "Can answer 'Why is this feature here?'",
                "nodes_with_source": nodes_with_source,
                "total_nodes": total_nodes,
                "traceability_pct": traceability_pct,
            },
            "what_changed": {
                "label": "Can answer 'What changed since kickoff?'",
                "sessions_with_history": sessions_with_history,
                "total_sessions": total,
                "pct": round(sessions_with_history / total * 100, 1),
            },
            "scope_disputes": {
                "label": "Reduced scope disputes (survey data)",
                "note": "Requires external survey integration",
                "available": False,
            },
            "team_alignment": {
                "label": "Team alignment feeling (survey data)",
                "note": "Requires external survey integration",
                "available": False,
            },
        }

    # ── 19.3 Technical Metrics ───────────────────────────────────

    def technical_metrics(
        self,
        metrics_snapshot: Dict[str, Any],
        ai_timing: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        METRIC-3.1 → 3.7 from the MetricsMiddleware snapshot
        plus supplementary timing data.
        """
        global_latency = metrics_snapshot.get("global_latency", {})
        total_requests = metrics_snapshot.get("total_requests", 0)
        total_errors = metrics_snapshot.get("total_errors", 0)
        per_route = metrics_snapshot.get("per_route", {})
        status_codes = metrics_snapshot.get("status_codes", {})

        # Error rate
        error_rate = round(
            (total_errors / max(total_requests, 1)) * 100, 2
        )

        # AI processing time from per_route (look for /sources/ingest, /chat, /suggest)
        ai_routes = {k: v for k, v in per_route.items() if any(
            seg in k for seg in ["ingest", "chat", "suggest", "generate"]
        )}
        ai_p95 = max(
            (v.get("p95_ms", 0) for v in ai_routes.values()), default=0
        )

        # PDF export time
        pdf_routes = {k: v for k, v in per_route.items() if "pdf" in k or "export" in k}
        pdf_p95 = max(
            (v.get("p95_ms", 0) for v in pdf_routes.values()), default=0
        )

        # Uptime proxy: 100% - error_rate (crude but reasonable)
        uptime_pct = round(100.0 - error_rate, 2)

        # Top 5 slowest routes
        slowest = sorted(
            per_route.items(),
            key=lambda x: x[1].get("p95_ms", 0),
            reverse=True,
        )[:5]

        return {
            "api_p95_ms": global_latency.get("p95_ms", 0),
            "api_p50_ms": global_latency.get("p50_ms", 0),
            "api_p99_ms": global_latency.get("p99_ms", 0),
            "target_api_p95_ms": TARGETS["api_p95_ms"],
            "ai_processing_p95_ms": round(ai_p95, 2),
            "target_ai_processing_ms": TARGETS["ai_processing_ms"],
            "pdf_generation_p95_ms": round(pdf_p95, 2),
            "target_pdf_generation_ms": TARGETS["pdf_generation_ms"],
            "total_requests": total_requests,
            "total_errors": total_errors,
            "error_rate_pct": error_rate,
            "uptime_pct": uptime_pct,
            "target_uptime_pct": TARGETS["uptime_pct"],
            "status_code_distribution": status_codes,
            "slowest_routes": [
                {"route": route, **data} for route, data in slowest
            ],
            "test_coverage_pct": None,  # Must be supplied externally (CI)
            "target_test_coverage_pct": TARGETS["test_coverage_pct"],
            "llm_api_costs": None,      # Requires external billing integration
        }

    # ── 19.1.7 Feature adoption breakdown ────────────────────────

    def _feature_adoption(
        self,
        db: DBSession,
        org_id: Optional[UUID],
        since: datetime,
    ) -> Dict[str, Any]:
        """Breakdown of feature usage rates."""
        sess_q = db.query(SessionModel.id)
        if org_id:
            sess_q = sess_q.filter(SessionModel.organization_id == org_id)
        session_ids_sq = sess_q.subquery()

        total_sessions = db.query(func.count()).select_from(session_ids_sq).scalar() or 1

        # Source ingestion used
        sessions_using_sources = (
            db.query(func.count(distinct(Source.session_id)))
            .filter(Source.session_id.in_(db.query(session_ids_sq)))
            .scalar()
        ) or 0

        # Planning board used (has ≥1 card)
        sessions_using_cards = (
            db.query(func.count(distinct(Card.session_id)))
            .filter(Card.session_id.in_(db.query(session_ids_sq)))
            .scalar()
        ) or 0

        # Team assignment used
        sessions_using_teams = (
            db.query(func.count(distinct(TeamMember.session_id)))
            .filter(TeamMember.session_id.in_(db.query(session_ids_sq)))
            .scalar()
        ) or 0

        # Acceptance criteria used
        sessions_using_ac = (
            db.query(func.count(distinct(Card.session_id)))
            .join(AcceptanceCriterion, AcceptanceCriterion.card_id == Card.id)
            .filter(Card.session_id.in_(db.query(session_ids_sq)))
            .scalar()
        ) or 0

        return {
            "source_ingestion": {
                "sessions": sessions_using_sources,
                "pct": round(sessions_using_sources / total_sessions * 100, 1),
            },
            "planning_board": {
                "sessions": sessions_using_cards,
                "pct": round(sessions_using_cards / total_sessions * 100, 1),
            },
            "team_assignment": {
                "sessions": sessions_using_teams,
                "pct": round(sessions_using_teams / total_sessions * 100, 1),
            },
            "acceptance_criteria": {
                "sessions": sessions_using_ac,
                "pct": round(sessions_using_ac / total_sessions * 100, 1),
            },
        }

    # ── Trend data (for charts) ──────────────────────────────────

    def daily_trends(
        self,
        db: DBSession,
        org_id: Optional[UUID] = None,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Return daily aggregate counts for sessions, nodes, changes,
        cards created — suitable for line/area charts.
        """
        since = datetime.utcnow() - timedelta(days=days)

        # Sessions created per day
        sess_q = (
            db.query(
                func.date(SessionModel.created_at).label("day"),
                func.count(SessionModel.id).label("sessions"),
            )
            .filter(SessionModel.created_at >= since)
        )
        if org_id:
            sess_q = sess_q.filter(SessionModel.organization_id == org_id)
        sess_by_day = {str(r.day): r.sessions for r in sess_q.group_by("day").all()}

        # Nodes created per day
        node_q = db.query(
            func.date(Node.created_at).label("day"),
            func.count(Node.id).label("nodes"),
        ).filter(Node.created_at >= since)
        if org_id:
            node_q = node_q.join(SessionModel).filter(SessionModel.organization_id == org_id)
        nodes_by_day = {str(r.day): r.nodes for r in node_q.group_by("day").all()}

        # Scope changes per day
        change_q = db.query(
            func.date(NodeHistory.changed_at).label("day"),
            func.count(NodeHistory.id).label("changes"),
        ).filter(NodeHistory.changed_at >= since)
        if org_id:
            change_q = change_q.join(SessionModel, NodeHistory.session_id == SessionModel.id).filter(
                SessionModel.organization_id == org_id
            )
        changes_by_day = {str(r.day): r.changes for r in change_q.group_by("day").all()}

        # Cards created per day
        card_q = db.query(
            func.date(Card.created_at).label("day"),
            func.count(Card.id).label("cards"),
        ).filter(Card.created_at >= since)
        if org_id:
            card_q = card_q.join(SessionModel).filter(SessionModel.organization_id == org_id)
        cards_by_day = {str(r.day): r.cards for r in card_q.group_by("day").all()}

        # Merge into list
        result = []
        for d in range(days):
            day_str = str((datetime.utcnow() - timedelta(days=days - 1 - d)).date())
            result.append({
                "date": day_str,
                "sessions": sess_by_day.get(day_str, 0),
                "nodes": nodes_by_day.get(day_str, 0),
                "changes": changes_by_day.get(day_str, 0),
                "cards": cards_by_day.get(day_str, 0),
            })

        return result


# Singleton
metrics_service = MetricsService()
