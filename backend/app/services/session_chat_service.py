"""
Session-level AI Chatbot Service.

Provides an intelligent assistant scoped to a specific session that can:
- Answer questions about the session's scope tree, nodes, team, cards, audit history
- Perform actions: create/edit/delete nodes, manage team members, assign cards
- Provide analytics: team performance, scope progress, change summaries

Uses OpenAI function-calling via the raw openai SDK for maximum control
over tool definitions and streaming.
"""
import json
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID, uuid4
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func, desc

from app.core.config import settings
from app.core.logger import get_logger
from app.models.database import (
    Session as SessionModel,
    Node, NodeType, NodeStatus, ChangeType,
    Card, CardStatus, CardPriority,
    TeamMember, Assignment, AssignmentRole,
    NodeHistory, User, SessionChatMessage,
    Source, Conversation, Message,
)
from app.services.audit_service import audit_service

logger = get_logger(__name__)


# ── Tool definitions for OpenAI function calling ────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_session_overview",
            "description": "Get a high-level overview of the session: project name, status, node counts by type and status, team size, card counts, source counts.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_scope_tree",
            "description": "Get the full scope/requirements tree structure with all nodes, their types, statuses, and hierarchy.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_nodes",
            "description": "Search for nodes by keyword in title or description. Returns matching nodes with their status, type, and parent.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword to find in node titles or descriptions"},
                    "status_filter": {"type": "string", "enum": ["active", "deferred", "completed", "removed", "new"], "description": "Optional status filter"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_team_members",
            "description": "Get all team members in the session with their roles and assignment counts.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_team_performance",
            "description": "Get team performance metrics: cards per member, completion rates, workload distribution, recent activity.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_planning_cards",
            "description": "Get all planning cards with their status, priority, assignees, and estimated hours. Optionally filter by status or assignee.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status_filter": {"type": "string", "enum": ["backlog", "todo", "in_progress", "review", "done"], "description": "Optional status filter"},
                    "assignee_name": {"type": "string", "description": "Optional assignee name filter"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_changes",
            "description": "Get recent audit trail changes. Shows what changed, when, and by whom.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of recent changes to return (default 20, max 50)"},
                    "user_name": {"type": "string", "description": "Optional: filter changes by user name"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sources",
            "description": "Get all ingested sources (documents, meeting notes, etc.) with their processing status and suggestion counts.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_node",
            "description": "Create a new node (feature/requirement) in the scope tree. Specify the parent node and details.",
            "parameters": {
                "type": "object",
                "properties": {
                    "parent_node_title": {"type": "string", "description": "Title of the parent node to add under. Use 'root' for top-level."},
                    "title": {"type": "string", "description": "Title/name of the new node"},
                    "description": {"type": "string", "description": "Description or answer for the node"},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_node",
            "description": "Update an existing node's title, description, or status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "node_title": {"type": "string", "description": "Current title of the node to update"},
                    "new_title": {"type": "string", "description": "New title (optional)"},
                    "new_description": {"type": "string", "description": "New description (optional)"},
                    "new_status": {"type": "string", "enum": ["active", "deferred", "completed", "removed"], "description": "New status (optional)"},
                    "reason": {"type": "string", "description": "Reason for the change"},
                },
                "required": ["node_title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_node",
            "description": "Delete/remove a node from the scope tree. This also removes all its children.",
            "parameters": {
                "type": "object",
                "properties": {
                    "node_title": {"type": "string", "description": "Title of the node to delete"},
                    "reason": {"type": "string", "description": "Reason for deletion"},
                },
                "required": ["node_title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_team_member",
            "description": "Add a new team member to the session.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name of the team member"},
                    "email": {"type": "string", "description": "Email address"},
                    "role": {"type": "string", "enum": ["developer", "designer", "pm", "qa", "devops", "analyst"], "description": "Role of the team member"},
                },
                "required": ["name", "role"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_team_member",
            "description": "Remove a team member from the session.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name of the team member to remove"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "assign_card_to_member",
            "description": "Assign a planning card (linked to a node) to a team member.",
            "parameters": {
                "type": "object",
                "properties": {
                    "node_title": {"type": "string", "description": "Title of the node whose card to assign"},
                    "member_name": {"type": "string", "description": "Name of the team member to assign to"},
                },
                "required": ["node_title", "member_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_node_conversations",
            "description": "Get the AI conversation history for a specific node (discovery Q&A).",
            "parameters": {
                "type": "object",
                "properties": {
                    "node_title": {"type": "string", "description": "Title of the node"},
                },
                "required": ["node_title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_scope_analytics",
            "description": "Get scope analytics: completion percentage, feature breakdown, priority distribution, estimated total hours, risk indicators.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


# ── Tool execution functions ────────────────────────────────────

class SessionChatTools:
    """Executes tool calls against the database for a specific session."""

    def __init__(self, db: DBSession, session_id: UUID, user_id: Optional[UUID] = None):
        self.db = db
        self.session_id = session_id
        self.user_id = user_id

    def _get_session(self) -> SessionModel:
        return self.db.query(SessionModel).filter(SessionModel.id == self.session_id).first()

    def _find_node_by_title(self, title: str) -> Optional[Node]:
        """Fuzzy-find a node by title within this session."""
        # Exact match first
        node = self.db.query(Node).filter(
            Node.session_id == self.session_id,
            func.lower(Node.question) == title.lower(),
        ).first()
        if node:
            return node
        # Contains match
        node = self.db.query(Node).filter(
            Node.session_id == self.session_id,
            func.lower(Node.question).contains(title.lower()),
        ).first()
        return node

    def _find_member_by_name(self, name: str) -> Optional[TeamMember]:
        member = self.db.query(TeamMember).filter(
            TeamMember.session_id == self.session_id,
            func.lower(TeamMember.name) == name.lower(),
        ).first()
        if member:
            return member
        return self.db.query(TeamMember).filter(
            TeamMember.session_id == self.session_id,
            func.lower(TeamMember.name).contains(name.lower()),
        ).first()

    def get_session_overview(self) -> Dict[str, Any]:
        session = self._get_session()
        nodes = self.db.query(Node).filter(Node.session_id == self.session_id).all()
        cards = self.db.query(Card).filter(Card.session_id == self.session_id).all()
        team = self.db.query(TeamMember).filter(TeamMember.session_id == self.session_id).all()
        sources = self.db.query(Source).filter(Source.session_id == self.session_id).all()

        status_counts = {}
        type_counts = {}
        for n in nodes:
            s = n.status.value if n.status else "unknown"
            t = n.node_type.value if n.node_type else "unknown"
            status_counts[s] = status_counts.get(s, 0) + 1
            type_counts[t] = type_counts.get(t, 0) + 1

        card_status_counts = {}
        for c in cards:
            cs = c.status.value if c.status else "unknown"
            card_status_counts[cs] = card_status_counts.get(cs, 0) + 1

        return {
            "project_name": session.document_filename or "Untitled",
            "session_status": session.status.value if session.status else "unknown",
            "total_nodes": len(nodes),
            "nodes_by_status": status_counts,
            "nodes_by_type": type_counts,
            "total_cards": len(cards),
            "cards_by_status": card_status_counts,
            "team_size": len(team),
            "team_members": [{"name": m.name, "role": m.role} for m in team],
            "sources_count": len(sources),
            "created_at": session.created_at.isoformat() if session.created_at else None,
        }

    def get_scope_tree(self) -> Dict[str, Any]:
        nodes = self.db.query(Node).filter(
            Node.session_id == self.session_id
        ).order_by(Node.depth, Node.order_index).all()

        def build_tree(parent_id=None, depth=0):
            children = [n for n in nodes if n.parent_id == parent_id]
            result = []
            for n in children:
                entry = {
                    "title": n.question,
                    "type": n.node_type.value if n.node_type else "unknown",
                    "status": n.status.value if n.status else "unknown",
                    "description": (n.answer or "")[:100],
                    "assigned_to": None,
                    "children": build_tree(n.id, depth + 1),
                }
                # Check assignment
                if n.assigned_to:
                    member = self.db.query(TeamMember).filter(TeamMember.id == n.assigned_to).first()
                    if member:
                        entry["assigned_to"] = member.name
                result.append(entry)
            return result

        tree = build_tree()
        return {"tree": tree, "total_nodes": len(nodes)}

    def search_nodes(self, query: str, status_filter: Optional[str] = None) -> List[Dict]:
        q = self.db.query(Node).filter(
            Node.session_id == self.session_id,
            (func.lower(Node.question).contains(query.lower()) |
             func.lower(Node.answer).contains(query.lower())),
        )
        if status_filter:
            q = q.filter(Node.status == status_filter)
        nodes = q.limit(20).all()
        return [
            {
                "title": n.question,
                "description": (n.answer or "")[:120],
                "type": n.node_type.value if n.node_type else "unknown",
                "status": n.status.value if n.status else "unknown",
                "depth": n.depth,
            }
            for n in nodes
        ]

    def get_team_members(self) -> List[Dict]:
        members = self.db.query(TeamMember).filter(
            TeamMember.session_id == self.session_id
        ).all()
        result = []
        for m in members:
            assignment_count = self.db.query(Assignment).filter(
                Assignment.team_member_id == m.id
            ).count()
            result.append({
                "name": m.name,
                "email": m.email,
                "role": m.role,
                "assignments": assignment_count,
            })
        return result

    def get_team_performance(self) -> Dict[str, Any]:
        members = self.db.query(TeamMember).filter(
            TeamMember.session_id == self.session_id
        ).all()

        perf = []
        for m in members:
            cards_query = (
                self.db.query(Card)
                .join(Assignment, Assignment.card_id == Card.id)
                .filter(Assignment.team_member_id == m.id)
            )
            total = cards_query.count()
            done = cards_query.filter(Card.status == CardStatus.DONE).count()
            in_progress = cards_query.filter(Card.status == CardStatus.IN_PROGRESS).count()
            hours = cards_query.with_entities(func.sum(Card.estimated_hours)).scalar() or 0

            # Recent changes by this member
            recent = self.db.query(NodeHistory).join(
                Node, NodeHistory.node_id == Node.id
            ).filter(
                Node.session_id == self.session_id,
            ).count()

            perf.append({
                "name": m.name,
                "role": m.role,
                "total_cards": total,
                "done": done,
                "in_progress": in_progress,
                "completion_rate": f"{(done/total*100):.0f}%" if total > 0 else "N/A",
                "estimated_hours": float(hours),
            })

        return {"team_performance": perf, "team_size": len(members)}

    def get_planning_cards(self, status_filter: Optional[str] = None, assignee_name: Optional[str] = None) -> List[Dict]:
        q = self.db.query(Card).filter(Card.session_id == self.session_id)
        if status_filter:
            q = q.filter(Card.status == status_filter)
        cards = q.all()

        result = []
        for c in cards:
            # Get assignees
            assignments = self.db.query(Assignment).filter(Assignment.card_id == c.id).all()
            assignees = []
            for a in assignments:
                member = self.db.query(TeamMember).filter(TeamMember.id == a.team_member_id).first()
                if member:
                    assignees.append(member.name)

            if assignee_name and not any(assignee_name.lower() in a.lower() for a in assignees):
                continue

            # Get linked node title
            node = self.db.query(Node).filter(Node.id == c.node_id).first()

            result.append({
                "title": c.title,
                "node": node.question if node else "Unknown",
                "status": c.status.value if c.status else "unknown",
                "priority": c.priority.value if c.priority else "medium",
                "assignees": assignees,
                "estimated_hours": float(c.estimated_hours) if c.estimated_hours else None,
            })
        return result

    def get_recent_changes(self, limit: int = 20, user_name: Optional[str] = None) -> List[Dict]:
        limit = min(limit or 20, 50)
        q = (
            self.db.query(NodeHistory)
            .join(Node, NodeHistory.node_id == Node.id)
            .filter(Node.session_id == self.session_id)
            .order_by(desc(NodeHistory.changed_at))
        )

        if user_name:
            # Find user by name
            user = self.db.query(User).filter(
                func.lower(User.username).contains(user_name.lower())
            ).first()
            if user:
                q = q.filter(NodeHistory.changed_by == user.id)

        records = q.limit(limit).all()
        result = []
        for r in records:
            node = self.db.query(Node).filter(Node.id == r.node_id).first()
            user = self.db.query(User).filter(User.id == r.changed_by).first() if r.changed_by else None
            result.append({
                "date": r.changed_at.strftime("%b %d, %H:%M") if r.changed_at else "",
                "node": node.question if node else "Deleted",
                "change": r.change_type.value if r.change_type else "",
                "field": r.field_changed or "",
                "old_value": (r.old_value or "")[:60],
                "new_value": (r.new_value or "")[:60],
                "by": user.username if user else "System",
                "reason": (r.change_reason or "")[:60],
            })
        return result

    def get_sources(self) -> List[Dict]:
        sources = self.db.query(Source).filter(Source.session_id == self.session_id).all()
        return [
            {
                "name": s.source_name,
                "type": s.source_type,
                "processed": s.is_processed,
                "suggestions": s.suggestions_count or 0,
                "approved": s.approved_count or 0,
                "created_at": s.created_at.strftime("%b %d, %H:%M") if s.created_at else "",
            }
            for s in sources
        ]

    def create_node(self, title: str, description: str = "", parent_node_title: Optional[str] = None) -> Dict:
        parent_id = None
        depth = 0

        if parent_node_title and parent_node_title.lower() != "root":
            parent = self._find_node_by_title(parent_node_title)
            if not parent:
                return {"error": f"Parent node '{parent_node_title}' not found in this session."}
            parent_id = parent.id
            depth = parent.depth + 1

        # Calculate order index
        siblings = self.db.query(Node).filter(
            Node.session_id == self.session_id,
            Node.parent_id == parent_id,
        ).order_by(Node.order_index.desc()).first()
        order_index = (siblings.order_index + 1) if siblings else 0

        node_type = NodeType.ROOT if depth == 0 else NodeType.FEATURE
        new_node = Node(
            session_id=self.session_id,
            parent_id=parent_id,
            question=title,
            answer=description,
            node_type=node_type,
            depth=depth,
            order_index=order_index,
            can_expand=True,
            is_expanded=False,
        )
        self.db.add(new_node)
        self.db.flush()

        audit_service.record_change(
            database=self.db,
            node_id=new_node.id,
            change_type=ChangeType.CREATED,
            new_value=title,
            changed_by=self.user_id,
            session_id=self.session_id,
        )
        self.db.commit()
        return {"success": True, "title": title, "id": str(new_node.id), "depth": depth}

    def update_node(self, node_title: str, new_title: Optional[str] = None,
                    new_description: Optional[str] = None, new_status: Optional[str] = None,
                    reason: Optional[str] = None) -> Dict:
        node = self._find_node_by_title(node_title)
        if not node:
            return {"error": f"Node '{node_title}' not found in this session."}

        changes = []
        if new_title and new_title != node.question:
            old = node.question
            node.question = new_title
            audit_service.record_change(
                database=self.db, node_id=node.id,
                change_type=ChangeType.MODIFIED,
                field_changed="title", old_value=old, new_value=new_title,
                changed_by=self.user_id, session_id=self.session_id,
                change_reason=reason,
            )
            changes.append(f"title → '{new_title}'")

        if new_description is not None:
            old = node.answer
            node.answer = new_description
            audit_service.record_change(
                database=self.db, node_id=node.id,
                change_type=ChangeType.MODIFIED,
                field_changed="description", old_value=(old or "")[:50], new_value=new_description[:50],
                changed_by=self.user_id, session_id=self.session_id,
                change_reason=reason,
            )
            changes.append("description updated")

        if new_status:
            old_status = node.status.value if node.status else "unknown"
            node.status = NodeStatus(new_status)
            audit_service.record_change(
                database=self.db, node_id=node.id,
                change_type=ChangeType.STATUS_CHANGED,
                field_changed="status", old_value=old_status, new_value=new_status,
                changed_by=self.user_id, session_id=self.session_id,
                change_reason=reason,
            )
            changes.append(f"status → {new_status}")

        self.db.commit()
        return {"success": True, "node": node.question, "changes": changes}

    def delete_node(self, node_title: str, reason: Optional[str] = None) -> Dict:
        node = self._find_node_by_title(node_title)
        if not node:
            return {"error": f"Node '{node_title}' not found in this session."}

        # Count descendants
        def count_descendants(nid):
            children = self.db.query(Node).filter(Node.parent_id == nid).all()
            total = len(children)
            for c in children:
                total += count_descendants(c.id)
            return total

        desc_count = count_descendants(node.id)

        audit_service.record_change(
            database=self.db, node_id=node.id,
            change_type=ChangeType.DELETED,
            old_value=node.question,
            changed_by=self.user_id, session_id=self.session_id,
            change_reason=reason,
        )

        # Delete descendants recursively
        def delete_tree(nid):
            children = self.db.query(Node).filter(Node.parent_id == nid).all()
            for c in children:
                delete_tree(c.id)
                self.db.delete(c)

        delete_tree(node.id)
        self.db.delete(node)
        self.db.commit()
        return {"success": True, "deleted": node_title, "descendants_removed": desc_count}

    def add_team_member(self, name: str, role: str, email: Optional[str] = None) -> Dict:
        existing = self._find_member_by_name(name)
        if existing:
            return {"error": f"Team member '{name}' already exists in this session."}

        import random
        colors = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"]
        member = TeamMember(
            session_id=self.session_id,
            name=name,
            email=email or "",
            role=role,
            avatar_color=random.choice(colors),
        )
        self.db.add(member)
        self.db.commit()
        return {"success": True, "name": name, "role": role}

    def remove_team_member(self, name: str) -> Dict:
        member = self._find_member_by_name(name)
        if not member:
            return {"error": f"Team member '{name}' not found."}

        # Remove assignments first
        self.db.query(Assignment).filter(Assignment.team_member_id == member.id).delete()
        self.db.delete(member)
        self.db.commit()
        return {"success": True, "removed": name}

    def assign_card_to_member(self, node_title: str, member_name: str) -> Dict:
        node = self._find_node_by_title(node_title)
        if not node:
            return {"error": f"Node '{node_title}' not found."}
        member = self._find_member_by_name(member_name)
        if not member:
            return {"error": f"Team member '{member_name}' not found."}

        card = self.db.query(Card).filter(Card.node_id == node.id).first()
        if not card:
            return {"error": f"No planning card exists for node '{node_title}'. Cards are created on the planning board."}

        # Check if already assigned
        existing = self.db.query(Assignment).filter(
            Assignment.card_id == card.id,
            Assignment.team_member_id == member.id,
        ).first()
        if existing:
            return {"info": f"'{member_name}' is already assigned to '{node_title}'."}

        assignment = Assignment(
            card_id=card.id,
            team_member_id=member.id,
            role=AssignmentRole.ASSIGNEE,
        )
        self.db.add(assignment)
        self.db.commit()
        return {"success": True, "card": card.title, "assigned_to": member_name}

    def get_node_conversations(self, node_title: str) -> Dict:
        node = self._find_node_by_title(node_title)
        if not node:
            return {"error": f"Node '{node_title}' not found."}

        convos = self.db.query(Conversation).filter(Conversation.node_id == node.id).all()
        if not convos:
            return {"info": f"No conversation history found for '{node_title}'."}

        result = []
        for c in convos:
            msgs = self.db.query(Message).filter(
                Message.conversation_id == c.id
            ).order_by(Message.created_at).all()
            result.append({
                "status": c.status.value if c.status else "unknown",
                "messages": [
                    {"role": m.role.value if hasattr(m.role, 'value') else m.role, "content": m.content[:200]}
                    for m in msgs
                ],
            })
        return {"conversations": result}

    def get_scope_analytics(self) -> Dict[str, Any]:
        nodes = self.db.query(Node).filter(Node.session_id == self.session_id).all()
        cards = self.db.query(Card).filter(Card.session_id == self.session_id).all()

        total = len(nodes)
        completed = sum(1 for n in nodes if n.status and n.status.value == "completed")
        active = sum(1 for n in nodes if n.status and n.status.value == "active")
        deferred = sum(1 for n in nodes if n.status and n.status.value == "deferred")

        priority_dist = {}
        for c in cards:
            p = c.priority.value if c.priority else "medium"
            priority_dist[p] = priority_dist.get(p, 0) + 1

        total_hours = sum(float(c.estimated_hours or 0) for c in cards)
        done_cards = sum(1 for c in cards if c.status and c.status.value == "done")

        return {
            "total_nodes": total,
            "completion_rate": f"{(completed/total*100):.0f}%" if total > 0 else "0%",
            "active_nodes": active,
            "completed_nodes": completed,
            "deferred_nodes": deferred,
            "total_cards": len(cards),
            "done_cards": done_cards,
            "priority_distribution": priority_dist,
            "total_estimated_hours": total_hours,
            "at_risk": deferred > total * 0.3 if total > 0 else False,
        }

    def execute_tool(self, tool_name: str, args: Dict) -> str:
        """Execute a tool call and return the JSON result."""
        fn_map = {
            "get_session_overview": lambda: self.get_session_overview(),
            "get_scope_tree": lambda: self.get_scope_tree(),
            "search_nodes": lambda: self.search_nodes(args.get("query", ""), args.get("status_filter")),
            "get_team_members": lambda: self.get_team_members(),
            "get_team_performance": lambda: self.get_team_performance(),
            "get_planning_cards": lambda: self.get_planning_cards(args.get("status_filter"), args.get("assignee_name")),
            "get_recent_changes": lambda: self.get_recent_changes(args.get("limit", 20), args.get("user_name")),
            "get_sources": lambda: self.get_sources(),
            "create_node": lambda: self.create_node(args["title"], args.get("description", ""), args.get("parent_node_title")),
            "update_node": lambda: self.update_node(args["node_title"], args.get("new_title"), args.get("new_description"), args.get("new_status"), args.get("reason")),
            "delete_node": lambda: self.delete_node(args["node_title"], args.get("reason")),
            "add_team_member": lambda: self.add_team_member(args["name"], args["role"], args.get("email")),
            "remove_team_member": lambda: self.remove_team_member(args["name"]),
            "assign_card_to_member": lambda: self.assign_card_to_member(args["node_title"], args["member_name"]),
            "get_node_conversations": lambda: self.get_node_conversations(args["node_title"]),
            "get_scope_analytics": lambda: self.get_scope_analytics(),
        }

        fn = fn_map.get(tool_name)
        if not fn:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})

        try:
            result = fn()
            return json.dumps(result, default=str)
        except Exception as e:
            logger.error(f"Tool {tool_name} failed: {e}")
            return json.dumps({"error": str(e)})


# ── Main chat orchestration ─────────────────────────────────────

SYSTEM_PROMPT = """You are the **Session Intelligence Assistant** for Hojaa, an AI-powered requirements discovery and project scoping platform.

You are scoped to a **specific project session**. You have access to tools that let you query and modify the session's scope tree, team, planning cards, audit history, and more.

## Your Capabilities
1. **Answer questions** about the project: scope structure, team composition, progress, history, analytics
2. **Perform actions** when asked: create/edit/delete requirements nodes, manage team members, assign cards
3. **Provide insights**: team performance analysis, scope health, change patterns, risk indicators

## Guidelines
- Always use tools to get current data before answering — never guess at project-specific information
- When performing write actions (create, update, delete), confirm what you did clearly
- For analytics questions, call get_scope_analytics or get_team_performance to get real numbers
- Be concise but thorough — use bullet points and structured formatting
- If asked about something outside this session's scope, explain that you only have access to this session
- When multiple nodes match a search, ask the user to clarify
- For destructive actions (delete, remove), mention what was removed so it's clear

## Formatting
- Use markdown formatting for readability
- Use **bold** for emphasis, bullet lists for multiple items
- Use tables when comparing data across team members or nodes
- Keep responses focused and actionable
"""


async def process_session_chat(
    db: DBSession,
    session_id: UUID,
    user_id: UUID,
    user_message: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Process a user message in the session chatbot.
    
    Uses OpenAI function calling to:
    1. Understand the user's intent
    2. Call relevant tools to gather data or perform actions
    3. Synthesize a helpful response
    
    Returns:
        {
            "response": str,           # AI response text
            "tool_calls": list,        # Tools that were called
            "actions_taken": list,     # Write operations performed
        }
    """
    import openai

    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    # Build messages array
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add conversation history (last 20 messages max)
    if chat_history:
        for msg in chat_history[-20:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    # Initialize tool executor
    tools_executor = SessionChatTools(db, session_id, user_id)
    all_tool_calls = []
    actions_taken = []

    # Model to use — use the standard tier for chatbot (good reasoning needed)
    model = settings.openai_model or "gpt-4o-mini"
    # If they have gpt-4o, use it for better tool calling
    if "gpt-4o" in (settings.task_model_conversation or settings.openai_model or ""):
        model = "gpt-4o"
    elif settings.openai_model:
        model = settings.openai_model

    # Loop: call model → execute tools → feed results back → until done
    max_iterations = 5
    for iteration in range(max_iterations):
        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=TOOLS,
                    tool_choice="auto",
                    temperature=0.3,
                    max_tokens=2000,
                ),
                timeout=settings.ai_timeout_seconds,
            )
        except asyncio.TimeoutError:
            return {
                "response": "I'm sorry, the request timed out. Please try again with a simpler question.",
                "tool_calls": all_tool_calls,
                "actions_taken": actions_taken,
            }
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return {
                "response": f"I encountered an error: {str(e)}. Please try again.",
                "tool_calls": all_tool_calls,
                "actions_taken": actions_taken,
            }

        choice = response.choices[0]
        msg = choice.message

        # If the model wants to call tools
        if msg.tool_calls:
            # Add assistant message with tool calls
            messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            })

            # Execute each tool call
            for tc in msg.tool_calls:
                fn_name = tc.function.name
                try:
                    fn_args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    fn_args = {}

                logger.info(f"Session chat tool call: {fn_name}({fn_args})")
                result = tools_executor.execute_tool(fn_name, fn_args)
                all_tool_calls.append({"name": fn_name, "args": fn_args, "result_preview": result[:200]})

                # Track write actions
                if fn_name in ("create_node", "update_node", "delete_node",
                               "add_team_member", "remove_team_member", "assign_card_to_member"):
                    actions_taken.append({"action": fn_name, "args": fn_args})

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })
        else:
            # No more tool calls — return the final response
            return {
                "response": msg.content or "I couldn't generate a response. Please try again.",
                "tool_calls": all_tool_calls,
                "actions_taken": actions_taken,
            }

    # Exhausted iterations
    return {
        "response": "I've gathered the information but hit the processing limit. Please ask a more specific question.",
        "tool_calls": all_tool_calls,
        "actions_taken": actions_taken,
    }
