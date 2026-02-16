"""
Planning service for lightweight task tracking with a Kanban board.
Manages cards, assignments, and team members linked to the knowledge graph.
"""
import random
import uuid
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import and_, func
from app.models.database import (
    Card, CardStatus, CardPriority, Assignment, AssignmentRole,
    TeamMember, Node, NodeType, NodeStatus, ChangeType,
    AcceptanceCriterion, CardComment, User,
)
from app.services.audit_service import audit_service
from app.core.logger import get_logger

logger = get_logger(__name__)


# ── Pydantic model for LLM card-placement response ──────────────
from pydantic import BaseModel as PydanticBase, Field as PydField

class _CardPlacementResult(PydanticBase):
    """LLM output: where a new card should be placed in the graph."""
    parent_node_id: str = PydField(description="The id of the best parent node for this card")
    node_type: str = PydField(default="feature", description="Node type: 'feature' or 'detail'")
    reasoning: str = PydField(default="", description="Brief explanation of why this parent was chosen")

# Palette for automatically assigning avatar colors to team members
AVATAR_COLORS = [
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
    "#ec4899", "#f43f5e", "#ef4444", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
    "#3b82f6", "#0ea5e9",
]


class PlanningService:
    """
    Service for managing the planning board.
    Creates cards from graph nodes and tracks their progress.
    """
    
    def get_board(
        self,
        database: DBSession,
        session_id: UUID,
        assignee_filter: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Get the full planning board for a session.
        
        Args:
            database: Database session
            session_id: Session ID
            assignee_filter: Optional — only return cards assigned to this team member
        
        Returns:
            Board data with columns, cards, and team members
        """
        # Get cards, excluding any whose node has been removed
        all_cards = (
            database.query(Card)
            .filter(Card.session_id == session_id)
            .all()
        )
        
        # Filter out cards for removed nodes (safety net)
        cards = []
        for card in all_cards:
            if card.node_id:
                node = database.query(Node).filter(Node.id == card.node_id).first()
                if node and (not node.status or node.status != NodeStatus.REMOVED):
                    cards.append(card)
            else:
                # Out-of-scope card (no node) — always include
                cards.append(card)
        
        # Optional: filter by assignee
        if assignee_filter:
            assigned_card_ids = {
                a.card_id
                for a in database.query(Assignment)
                .filter(Assignment.team_member_id == assignee_filter)
                .all()
            }
            cards = [c for c in cards if c.id in assigned_card_ids]
        
        team_members = (
            database.query(TeamMember)
            .filter(TeamMember.session_id == session_id)
            .all()
        )
        
        # Organize cards by column
        columns = {
            "backlog": [],
            "todo": [],
            "in_progress": [],
            "review": [],
            "done": [],
        }
        
        completed_count = 0
        # Weighted progress: backlog=0, todo=20, in_progress=50, review=80, done=100
        COLUMN_WEIGHTS = {
            "backlog": 0,
            "todo": 20,
            "in_progress": 50,
            "review": 80,
            "done": 100,
        }
        weighted_sum = 0
        
        for card in cards:
            card_data = self._serialize_card(card, database)
            column_key = card.status.value
            if column_key in columns:
                columns[column_key].append(card_data)
            if card.status == CardStatus.DONE:
                completed_count += 1
            weighted_sum += COLUMN_WEIGHTS.get(column_key, 0)
        
        progress_pct = round(weighted_sum / len(cards)) if cards else 0
        
        team_member_list = []
        for member in team_members:
            team_member_list.append({
                "id": str(member.id),
                "session_id": str(member.session_id),
                "name": member.name,
                "email": member.email,
                "role": member.role,
                "avatar_color": member.avatar_color,
                "created_at": member.created_at.isoformat(),
            })
        
        return {
            "session_id": str(session_id),
            "columns": columns,
            "team_members": team_member_list,
            "total_cards": len(cards),
            "completed_cards": completed_count,
            "progress_percentage": progress_pct,
        }
    
    async def create_card(
        self,
        database: DBSession,
        session_id: UUID,
        node_id: Optional[UUID] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        priority: str = "medium",
        due_date=None,
        is_out_of_scope: bool = False,
        created_by: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Create a planning card.
        
        If node_id is provided, card is linked to the graph node.
        If node_id is None, a standalone (out-of-scope) card is created with
        the supplied title/description.
        """
        if node_id:
            # Check if card already exists for this node
            existing_card = database.query(Card).filter(Card.node_id == node_id).first()
            if existing_card:
                raise ValueError(f"A card already exists for node {node_id}")
            
            # Verify node exists
            node = database.query(Node).filter(Node.id == node_id).first()
            if not node:
                raise ValueError(f"Node {node_id} not found")
        elif not title:
            raise ValueError("title is required for manual / out-of-scope cards")
        elif not is_out_of_scope and title:
            # Manual card with title but no node_id → auto-place in graph via LLM
            try:
                placed_node_id = await self._auto_place_in_graph(database, session_id, title, description)
                if placed_node_id:
                    node_id = placed_node_id
                    logger.info(f"LLM auto-placed card '{title[:40]}' under node {node_id}")
            except Exception as exc:
                logger.warning(f"LLM auto-placement failed, creating unlinked card: {exc}")
        
        card = Card(
            node_id=node_id,
            session_id=session_id,
            title=title,
            description=description,
            status=CardStatus.BACKLOG,
            priority=CardPriority(priority),
            due_date=due_date,
            is_out_of_scope=is_out_of_scope,
        )
        database.add(card)
        database.flush()
        
        # Record in audit trail
        if node_id:
            audit_service.record_change(
                database=database,
                node_id=node_id,
                change_type=ChangeType.MODIFIED,
                field_changed="planning_card",
                old_value=None,
                new_value="Card created",
                changed_by=created_by,
            )
        
        # Auto-populate acceptance criteria from child nodes
        if node_id:
            self._populate_ac_from_children(database, card.id, node_id)
        
        database.commit()
        database.refresh(card)
        
        return self._serialize_card(card, database)
    
    def bulk_create_cards(
        self,
        database: DBSession,
        session_id: UUID,
        node_types: List[str] = None,
        include_details: bool = False,
        created_by: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        """
        Bulk create cards from graph nodes.
        
        Args:
            database: Database session
            session_id: Session to create cards for
            node_types: Which node types to include (default: feature only)
            include_details: Whether to include detail-level nodes
            created_by: User creating the cards
        
        Returns:
            List of created card data
        """
        if node_types is None:
            node_types = ["feature"]
        if include_details:
            node_types.append("detail")
        
        # Get nodes that don't already have cards
        existing_card_node_ids = [
            card.node_id
            for card in database.query(Card).filter(Card.session_id == session_id).all()
            if card.node_id is not None
        ]
        
        nodes = (
            database.query(Node)
            .filter(
                and_(
                    Node.session_id == session_id,
                    Node.node_type.in_([NodeType(nt) for nt in node_types]),
                    Node.status == NodeStatus.ACTIVE,
                    ~Node.id.in_(existing_card_node_ids) if existing_card_node_ids else True,
                )
            )
            .order_by(Node.depth, Node.order_index)
            .all()
        )
        
        created_cards = []
        for node in nodes:
            card = Card(
                node_id=node.id,
                session_id=session_id,
                status=CardStatus.BACKLOG,
                priority=CardPriority(node.priority.value if node.priority else "medium"),
            )
            database.add(card)
            created_cards.append(card)
        
        database.commit()
        
        result = []
        for card in created_cards:
            database.refresh(card)
            result.append(self._serialize_card(card, database))
        
        logger.info(f"Bulk created {len(result)} cards for session {session_id}")
        return result
    
    def update_card(
        self,
        database: DBSession,
        card_id: UUID,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        due_date=None,
        estimated_hours: Optional[float] = None,
        actual_hours: Optional[float] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        updated_by: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Update a planning card.
        Syncs status changes back to the graph node.
        """
        card = database.query(Card).filter(Card.id == card_id).first()
        if not card:
            raise ValueError(f"Card {card_id} not found")
        
        old_status = card.status.value if card.status else None
        
        if status:
            card.status = CardStatus(status)
            # Mark completed timestamp
            if status == "done" and not card.completed_at:
                card.completed_at = datetime.utcnow()
            elif status != "done":
                card.completed_at = None
            
            # Sync status back to node (only if linked)
            if card.node_id:
                node = database.query(Node).filter(Node.id == card.node_id).first()
                if node:
                    # Log every card column change to node history
                    if old_status != status:
                        audit_service.record_change(
                            database=database,
                            node_id=node.id,
                            change_type=ChangeType.STATUS_CHANGED,
                            field_changed="card_status",
                            old_value=old_status,
                            new_value=status,
                            change_reason=f"Card moved from {old_status} to {status}",
                            changed_by=updated_by,
                        )
                    # Mark node completed when card is done
                    if status == "done":
                        node.status = NodeStatus.COMPLETED
                    # Reverse sync: moving card back from done → revert node to active
                    elif old_status == "done" and status != "done":
                        if node.status == NodeStatus.COMPLETED:
                            node.status = NodeStatus.ACTIVE
                            audit_service.record_change(
                                database=database,
                                node_id=node.id,
                                change_type=ChangeType.STATUS_CHANGED,
                                field_changed="status",
                                old_value="completed",
                                new_value="active",
                                change_reason="Card moved out of done — reopened",
                                changed_by=updated_by,
                            )
        
        if priority:
            card.priority = CardPriority(priority)
        
        if due_date is not None:
            card.due_date = due_date
        
        if estimated_hours is not None:
            card.estimated_hours = estimated_hours
        
        if actual_hours is not None:
            card.actual_hours = actual_hours
        
        content_changed = False

        if title is not None:
            card.title = title
            content_changed = True
        
        if description is not None:
            card.description = description
            content_changed = True
        
        # Mark linked node as modified when card content changes
        if content_changed and card.node_id:
            node = database.query(Node).filter(Node.id == card.node_id).first()
            if node and node.status not in (NodeStatus.COMPLETED, NodeStatus.REMOVED):
                node.status = NodeStatus.MODIFIED
                # Sync title/description to the graph node
                if title is not None:
                    node.question = title
                if description is not None:
                    node.answer = description
                audit_service.record_change(
                    database=database,
                    node_id=node.id,
                    change_type=ChangeType.MODIFIED,
                    field_changed="content",
                    old_value=None,
                    new_value="Updated via planning card",
                    changed_by=updated_by,
                )
        
        card.updated_at = datetime.utcnow()
        database.commit()
        database.refresh(card)
        
        return self._serialize_card(card, database)
    
    def assign_card(
        self,
        database: DBSession,
        card_id: UUID,
        team_member_id: UUID,
        role: str = "assignee",
        assigned_by: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Assign a team member to a card."""
        card = database.query(Card).filter(Card.id == card_id).first()
        if not card:
            raise ValueError(f"Card {card_id} not found")
        
        team_member = database.query(TeamMember).filter(TeamMember.id == team_member_id).first()
        if not team_member:
            raise ValueError(f"Team member {team_member_id} not found")
        
        # Check for duplicate assignment
        existing_assignment = (
            database.query(Assignment)
            .filter(
                and_(
                    Assignment.card_id == card_id,
                    Assignment.team_member_id == team_member_id,
                )
            )
            .first()
        )
        if existing_assignment:
            # Update role instead of duplicating
            existing_assignment.role = AssignmentRole(role)
            database.commit()
            database.refresh(existing_assignment)
        else:
            assignment = Assignment(
                card_id=card_id,
                node_id=card.node_id,
                team_member_id=team_member_id,
                role=AssignmentRole(role),
                assigned_by=assigned_by,
            )
            database.add(assignment)
            database.commit()
        
        return self._serialize_card(card, database)
    
    def add_team_member(
        self,
        database: DBSession,
        session_id: UUID,
        name: str,
        email: Optional[str] = None,
        role: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Add a team member to a session."""
        avatar_color = random.choice(AVATAR_COLORS)
        
        member = TeamMember(
            session_id=session_id,
            name=name,
            email=email,
            role=role,
            avatar_color=avatar_color,
        )
        database.add(member)
        database.commit()
        database.refresh(member)
        
        return {
            "id": str(member.id),
            "session_id": str(member.session_id),
            "name": member.name,
            "email": member.email,
            "role": member.role,
            "avatar_color": member.avatar_color,
            "created_at": member.created_at.isoformat(),
        }
    
    def get_team_members(
        self,
        database: DBSession,
        session_id: UUID,
    ) -> List[Dict[str, Any]]:
        """Get all team members for a session."""
        members = (
            database.query(TeamMember)
            .filter(TeamMember.session_id == session_id)
            .all()
        )
        
        return [
            {
                "id": str(member.id),
                "session_id": str(member.session_id),
                "name": member.name,
                "email": member.email,
                "role": member.role,
                "avatar_color": member.avatar_color,
                "created_at": member.created_at.isoformat(),
            }
            for member in members
        ]
    
    def delete_team_member(
        self,
        database: DBSession,
        team_member_id: UUID,
    ) -> None:
        """Delete a team member and their assignments."""
        member = database.query(TeamMember).filter(TeamMember.id == team_member_id).first()
        if not member:
            raise ValueError(f"Team member {team_member_id} not found")
        
        database.delete(member)
        database.commit()
    
    def remove_assignment(
        self,
        database: DBSession,
        card_id: UUID,
        team_member_id: UUID,
    ) -> None:
        """Remove a team member assignment from a card."""
        assignment = (
            database.query(Assignment)
            .filter(
                and_(
                    Assignment.card_id == card_id,
                    Assignment.team_member_id == team_member_id,
                )
            )
            .first()
        )
        if assignment:
            database.delete(assignment)
            database.commit()
    
    def sync_node_to_cards(
        self,
        database: DBSession,
        node_id: UUID,
        node_status: str,
        session_id: UUID,
    ) -> None:
        """
        Synchronize planning cards when a node's status changes.
        
        - Node REMOVED → delete the card and its assignments
        - Node DEFERRED → move card to backlog
        - Node COMPLETED → move card to done
        - Node ACTIVE (new) → auto-create card if board has existing cards
        """
        existing_card = database.query(Card).filter(Card.node_id == node_id).first()
        
        if node_status == "removed":
            if existing_card:
                # Delete assignments first, then the card
                database.query(Assignment).filter(
                    Assignment.card_id == existing_card.id
                ).delete(synchronize_session="fetch")
                database.delete(existing_card)
                database.commit()
                logger.info(f"Removed planning card for node {node_id}")
        
        elif node_status == "deferred":
            if existing_card:
                existing_card.status = CardStatus.BACKLOG
                existing_card.updated_at = datetime.utcnow()
                database.commit()
                logger.info(f"Moved card for node {node_id} to backlog (deferred)")
        
        elif node_status == "completed":
            if existing_card:
                existing_card.status = CardStatus.DONE
                existing_card.completed_at = datetime.utcnow()
                existing_card.updated_at = datetime.utcnow()
                database.commit()
                logger.info(f"Moved card for node {node_id} to done (completed)")
        
        elif node_status == "active":
            # Auto-create a card if the session already has cards on the board
            if not existing_card:
                board_has_cards = (
                    database.query(Card)
                    .filter(Card.session_id == session_id)
                    .count() > 0
                )
                if board_has_cards:
                    node = database.query(Node).filter(Node.id == node_id).first()
                    if node and node.node_type != NodeType.ROOT:
                        new_card = Card(
                            node_id=node_id,
                            session_id=session_id,
                            status=CardStatus.BACKLOG,
                            priority=CardPriority(
                                node.priority.value if node.priority else "medium"
                            ),
                        )
                        database.add(new_card)
                        database.commit()
                        logger.info(f"Auto-created planning card for new node {node_id}")
    
    def _serialize_card(self, card: Card, database: DBSession) -> Dict[str, Any]:
        """Serialize a card with its node data, assignments, AC, and comments."""
        node = None
        if card.node_id:
            node = database.query(Node).filter(Node.id == card.node_id).first()
        
        assignments = (
            database.query(Assignment)
            .filter(Assignment.card_id == card.id)
            .all()
        )
        
        assignment_list = []
        for assignment in assignments:
            member = database.query(TeamMember).filter(
                TeamMember.id == assignment.team_member_id
            ).first()
            assignment_list.append({
                "id": str(assignment.id),
                "team_member_id": str(assignment.team_member_id),
                "team_member_name": member.name if member else "Unknown",
                "role": assignment.role.value,
                "assigned_at": assignment.assigned_at.isoformat(),
            })
        
        # Acceptance criteria
        ac_items = (
            database.query(AcceptanceCriterion)
            .filter(AcceptanceCriterion.card_id == card.id)
            .order_by(AcceptanceCriterion.order_index)
            .all()
        )
        ac_list = [
            {
                "id": str(ac.id),
                "card_id": str(ac.card_id),
                "node_id": str(ac.node_id) if ac.node_id else None,
                "description": ac.description,
                "is_completed": ac.is_completed,
                "completed_at": ac.completed_at.isoformat() if ac.completed_at else None,
                "order_index": ac.order_index,
            }
            for ac in ac_items
        ]
        ac_completed = sum(1 for ac in ac_items if ac.is_completed)
        
        # Comments (latest first, limited to 20)
        comment_records = (
            database.query(CardComment)
            .filter(CardComment.card_id == card.id)
            .order_by(CardComment.created_at.desc())
            .limit(20)
            .all()
        )
        comments_list = []
        for c in comment_records:
            author = database.query(User).filter(User.id == c.author_id).first() if c.author_id else None
            comments_list.append({
                "id": str(c.id),
                "card_id": str(c.card_id),
                "author_name": author.username if author else None,
                "content": c.content,
                "created_at": c.created_at.isoformat(),
            })
        
        # Derive display title/description from card overrides or linked node
        display_title = card.title or (node.question if node else "Untitled")
        display_description = card.description or (node.answer if node else None)
        
        return {
            "id": str(card.id),
            "node_id": str(card.node_id) if card.node_id else None,
            "session_id": str(card.session_id),
            "node_title": display_title,
            "node_description": display_description,
            "node_type": node.node_type.value if node else "feature",
            "node_status": node.status.value if node and node.status else None,
            "title": card.title,
            "description": card.description,
            "status": card.status.value,
            "priority": card.priority.value,
            "is_out_of_scope": card.is_out_of_scope,
            "due_date": card.due_date.isoformat() if card.due_date else None,
            "estimated_hours": card.estimated_hours,
            "actual_hours": card.actual_hours,
            "assignments": assignment_list,
            "acceptance_criteria": ac_list,
            "comments": comments_list,
            "ac_total": len(ac_items),
            "ac_completed": ac_completed,
            "completed_at": card.completed_at.isoformat() if card.completed_at else None,
            "created_at": card.created_at.isoformat(),
            "updated_at": card.updated_at.isoformat(),
        }

    # ── Delete card ──────────────────────────────────────────────────

    def delete_card(
        self, database: DBSession, card_id: UUID
    ) -> bool:
        """Delete a card and its assignments, AC items, and comments."""
        card = database.query(Card).filter(Card.id == card_id).first()
        if not card:
            raise ValueError("Card not found")

        # Delete related records
        database.query(Assignment).filter(Assignment.card_id == card_id).delete()
        database.query(AcceptanceCriterion).filter(AcceptanceCriterion.card_id == card_id).delete()
        database.query(CardComment).filter(CardComment.card_id == card_id).delete()
        database.delete(card)
        database.commit()
        return True

    # ── LLM auto-placement ───────────────────────────────────────────

    async def _auto_place_in_graph(
        self,
        database: DBSession,
        session_id: UUID,
        title: str,
        description: Optional[str],
    ) -> Optional[UUID]:
        """
        Use the LLM to decide which parent node a new card should live under,
        then create a new graph node there and return its id.
        """
        from app.services.agent_service import agent_service, cached_agent_run

        # Build a concise map of the current graph for the LLM
        nodes = (
            database.query(Node)
            .filter(
                Node.session_id == session_id,
                Node.status.in_([NodeStatus.ACTIVE, NodeStatus.NEW, NodeStatus.MODIFIED]),
            )
            .order_by(Node.depth, Node.order_index)
            .all()
        )
        if not nodes:
            return None

        graph_lines = []
        for n in nodes:
            indent = "  " * (n.depth or 0)
            graph_lines.append(
                f"{indent}- id={n.id}  type={n.node_type.value}  "
                f"title=\"{(n.question or '')[:80]}\""
            )
        graph_text = "\n".join(graph_lines)

        prompt = (
            f"Here is the current requirements tree for a project:\n"
            f"```\n{graph_text}\n```\n\n"
            f"A user wants to add a new card:\n"
            f"  Title: {title}\n"
            f"  Description: {description or '(none)'}\n\n"
            f"Pick the single best parent node (by id) where this card should "
            f"be placed as a child. Return the parent_node_id (copy the id exactly), "
            f"the node_type ('feature' or 'detail'), and a brief reasoning."
        )

        agent = agent_service.create_agent(
            system_prompt=(
                "You are a requirements-engineering assistant. "
                "Given a project's requirements tree and a new card, "
                "decide the most logical parent node for that card. "
                "Return the parent_node_id exactly as it appears in the tree."
            ),
            output_type=_CardPlacementResult,
        )

        # Properly await the async agent within FastAPI's event loop (RISK-2.3C: logged)
        result = await cached_agent_run(
            agent, prompt, task="tree_building",
            session_id=str(session_id),
        )

        placement = result.output
        # Convert the string id returned by LLM to a proper UUID
        try:
            parent_uuid = UUID(placement.parent_node_id)
        except (ValueError, AttributeError):
            logger.warning(f"LLM returned invalid parent id: {placement.parent_node_id}")
            return None

        # Verify the chosen parent exists
        parent = database.query(Node).filter(Node.id == parent_uuid).first()
        if not parent:
            logger.warning(f"LLM chose non-existent parent {placement.parent_node_id}")
            return None

        # Determine order_index (append after existing siblings)
        max_order = (
            database.query(func.max(Node.order_index))
            .filter(Node.parent_id == parent.id)
            .scalar()
        )
        next_order = (max_order or 0) + 1

        # Create a new node under the chosen parent
        new_node = Node(
            session_id=session_id,
            parent_id=parent.id,
            question=title,
            answer=description,
            node_type=NodeType(placement.node_type) if placement.node_type in ("feature", "detail") else NodeType.FEATURE,
            status=NodeStatus.NEW,
            depth=(parent.depth or 0) + 1,
            order_index=next_order,
            can_expand=False,
            is_expanded=False,
        )
        database.add(new_node)
        database.flush()
        logger.info(f"Auto-placed node '{title[:40]}' under '{parent.question[:40]}' — {placement.reasoning[:80]}")
        return new_node.id

    # ── Acceptance Criteria helpers ───────────────────────────────────

    def _populate_ac_from_children(
        self, database: DBSession, card_id: uuid.UUID, node_id: str
    ) -> None:
        """Auto-create AcceptanceCriterion items from child nodes of the linked node."""
        children = (
            database.query(Node)
            .filter(Node.parent_id == node_id)
            .order_by(Node.created_at)
            .all()
        )
        for idx, child in enumerate(children):
            ac = AcceptanceCriterion(
                card_id=card_id,
                node_id=child.id,
                description=child.question or child.answer or f"Child: {child.id}",
                order_index=idx,
            )
            database.add(ac)
        database.commit()

    def add_acceptance_criterion(
        self,
        database: DBSession,
        card_id: uuid.UUID,
        description: str,
        node_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Add a manual acceptance criterion to a card."""
        card = database.query(Card).filter(Card.id == card_id).first()
        if not card:
            raise ValueError("Card not found")

        max_idx = (
            database.query(func.max(AcceptanceCriterion.order_index))
            .filter(AcceptanceCriterion.card_id == card_id)
            .scalar()
        )
        ac = AcceptanceCriterion(
            card_id=card_id,
            node_id=node_id,
            description=description,
            order_index=(max_idx or 0) + 1,
        )
        database.add(ac)
        database.commit()
        database.refresh(ac)
        return {
            "id": str(ac.id),
            "card_id": str(ac.card_id),
            "node_id": str(ac.node_id) if ac.node_id else None,
            "description": ac.description,
            "is_completed": ac.is_completed,
            "completed_at": None,
            "order_index": ac.order_index,
        }

    def update_acceptance_criterion(
        self,
        database: DBSession,
        criterion_id: uuid.UUID,
        description: Optional[str] = None,
        is_completed: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Update / toggle an acceptance criterion. Auto-completes the card when all AC done."""
        ac = database.query(AcceptanceCriterion).filter(AcceptanceCriterion.id == criterion_id).first()
        if not ac:
            raise ValueError("Acceptance criterion not found")

        if description is not None:
            ac.description = description
        if is_completed is not None:
            ac.is_completed = is_completed
            ac.completed_at = datetime.utcnow() if is_completed else None

        database.commit()
        database.refresh(ac)

        # Auto-complete card if all AC are done
        self._check_auto_complete(database, ac.card_id)

        return {
            "id": str(ac.id),
            "card_id": str(ac.card_id),
            "node_id": str(ac.node_id) if ac.node_id else None,
            "description": ac.description,
            "is_completed": ac.is_completed,
            "completed_at": ac.completed_at.isoformat() if ac.completed_at else None,
            "order_index": ac.order_index,
        }

    def delete_acceptance_criterion(
        self, database: DBSession, criterion_id: uuid.UUID
    ) -> bool:
        """Delete an acceptance criterion."""
        ac = database.query(AcceptanceCriterion).filter(AcceptanceCriterion.id == criterion_id).first()
        if not ac:
            return False
        database.delete(ac)
        database.commit()
        return True

    def _check_auto_complete(self, database: DBSession, card_id: uuid.UUID) -> None:
        """If every AC on a card is completed, auto-set card status to done."""
        total = database.query(AcceptanceCriterion).filter(AcceptanceCriterion.card_id == card_id).count()
        if total == 0:
            return
        completed = (
            database.query(AcceptanceCriterion)
            .filter(AcceptanceCriterion.card_id == card_id, AcceptanceCriterion.is_completed == True)
            .count()
        )
        if completed == total:
            card = database.query(Card).filter(Card.id == card_id).first()
            if card and card.status != CardStatus.DONE:
                card.status = CardStatus.DONE
                card.completed_at = datetime.utcnow()
                database.commit()

    # ── Comments ─────────────────────────────────────────────────────

    def add_comment(
        self,
        database: DBSession,
        card_id: uuid.UUID,
        content: str,
        author_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Add a comment / note to a card."""
        card = database.query(Card).filter(Card.id == card_id).first()
        if not card:
            raise ValueError("Card not found")

        comment = CardComment(
            card_id=card_id,
            author_id=author_id,
            content=content,
        )
        database.add(comment)
        database.commit()
        database.refresh(comment)

        author = database.query(User).filter(User.id == author_id).first() if author_id else None
        return {
            "id": str(comment.id),
            "card_id": str(comment.card_id),
            "author_name": author.username if author else None,
            "content": comment.content,
            "created_at": comment.created_at.isoformat(),
        }

    def get_card_comments(
        self, database: DBSession, card_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """Get all comments for a card."""
        comments = (
            database.query(CardComment)
            .filter(CardComment.card_id == card_id)
            .order_by(CardComment.created_at.desc())
            .all()
        )
        result = []
        for c in comments:
            author = database.query(User).filter(User.id == c.author_id).first() if c.author_id else None
            result.append({
                "id": str(c.id),
                "card_id": str(c.card_id),
                "author_name": author.username if author else None,
                "content": c.content,
                "created_at": c.created_at.isoformat(),
            })
        return result

    # ── Workload view ────────────────────────────────────────────────

    def get_workload(
        self, database: DBSession, session_id: uuid.UUID
    ) -> List[Dict[str, Any]]:
        """Return workload summary per team member for the session."""
        members = (
            database.query(TeamMember)
            .filter(TeamMember.session_id == session_id)
            .all()
        )
        result = []
        for member in members:
            assigned_cards = (
                database.query(Card)
                .join(Assignment, Assignment.card_id == Card.id)
                .filter(
                    Assignment.team_member_id == member.id,
                    Card.session_id == session_id,
                )
                .all()
            )
            total = len(assigned_cards)
            done = sum(1 for c in assigned_cards if c.status == CardStatus.DONE)
            in_progress = sum(1 for c in assigned_cards if c.status == CardStatus.IN_PROGRESS)
            est = sum(c.estimated_hours or 0 for c in assigned_cards)
            act = sum(c.actual_hours or 0 for c in assigned_cards)
            # Weighted progress per member
            w_weights = {"backlog": 0, "todo": 20, "in_progress": 50, "review": 80, "done": 100}
            w_sum = sum(w_weights.get(c.status.value, 0) for c in assigned_cards)
            w_pct = round(w_sum / total) if total else 0
            result.append({
                "team_member_id": str(member.id),
                "team_member_name": member.name,
                "role": member.role,
                "total_cards": total,
                "completed_cards": done,
                "in_progress_cards": in_progress,
                "estimated_hours": est,
                "actual_hours": act,
                "progress_percentage": w_pct,
            })
        return result

    # ── Out-of-scope helpers ─────────────────────────────────────────

    def add_out_of_scope_to_graph(
        self,
        database: DBSession,
        card_id: uuid.UUID,
        parent_node_id: str,
    ) -> Dict[str, Any]:
        """Convert an out-of-scope card into a real graph node."""
        card = database.query(Card).filter(Card.id == card_id).first()
        if not card:
            raise ValueError("Card not found")
        if not card.is_out_of_scope:
            raise ValueError("Card is not marked as out-of-scope")

        new_node = Node(
            id=str(uuid.uuid4()),
            session_id=card.session_id,
            parent_id=parent_node_id,
            question=card.title or "Untitled",
            answer=card.description,
            node_type=NodeType.feature,
            status=NodeStatus.active,
        )
        database.add(new_node)

        # Link card to the new node and clear out-of-scope flag
        card.node_id = new_node.id
        card.is_out_of_scope = False
        database.commit()
        database.refresh(card)

        return self._serialize_card(card, database)


# Global instance
planning_service = PlanningService()
