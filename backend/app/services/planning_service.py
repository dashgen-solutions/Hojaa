"""
Planning service for lightweight task tracking with a Kanban board.
Manages cards, assignments, and team members linked to the knowledge graph.
"""
import random
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import and_
from app.models.database import (
    Card, CardStatus, CardPriority, Assignment, AssignmentRole,
    TeamMember, Node, NodeType, NodeStatus, ChangeType
)
from app.services.audit_service import audit_service
from app.core.logger import get_logger

logger = get_logger(__name__)

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
    ) -> Dict[str, Any]:
        """
        Get the full planning board for a session.
        
        Returns:
            Board data with columns, cards, and team members
        """
        cards = (
            database.query(Card)
            .filter(Card.session_id == session_id)
            .all()
        )
        
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
        
        for card in cards:
            card_data = self._serialize_card(card, database)
            column_key = card.status.value
            if column_key in columns:
                columns[column_key].append(card_data)
            if card.status == CardStatus.DONE:
                completed_count += 1
        
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
        }
    
    def create_card(
        self,
        database: DBSession,
        node_id: UUID,
        session_id: UUID,
        priority: str = "medium",
        due_date=None,
        created_by: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Create a planning card from a graph node.
        
        Args:
            database: Database session
            node_id: Node to create card from
            session_id: Session the card belongs to
            priority: Priority level
            due_date: Optional due date
            created_by: User creating the card
        
        Returns:
            Serialized card data
        """
        # Check if card already exists for this node
        existing_card = database.query(Card).filter(Card.node_id == node_id).first()
        if existing_card:
            raise ValueError(f"A card already exists for node {node_id}")
        
        # Verify node exists
        node = database.query(Node).filter(Node.id == node_id).first()
        if not node:
            raise ValueError(f"Node {node_id} not found")
        
        card = Card(
            node_id=node_id,
            session_id=session_id,
            status=CardStatus.BACKLOG,
            priority=CardPriority(priority),
            due_date=due_date,
        )
        database.add(card)
        database.flush()
        
        # Record in audit trail
        audit_service.record_change(
            database=database,
            node_id=node_id,
            change_type=ChangeType.MODIFIED,
            field_changed="planning_card",
            old_value=None,
            new_value="Card created",
            changed_by=created_by,
        )
        
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
            
            # Sync status back to node
            node = database.query(Node).filter(Node.id == card.node_id).first()
            if node and status == "done":
                node.status = NodeStatus.COMPLETED
                audit_service.record_change(
                    database=database,
                    node_id=node.id,
                    change_type=ChangeType.STATUS_CHANGED,
                    field_changed="status",
                    old_value=old_status,
                    new_value="completed",
                    change_reason="Card marked as done on planning board",
                    changed_by=updated_by,
                )
        
        if priority:
            card.priority = CardPriority(priority)
        
        if due_date is not None:
            card.due_date = due_date
        
        if estimated_hours is not None:
            card.estimated_hours = estimated_hours
        
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
    
    def _serialize_card(self, card: Card, database: DBSession) -> Dict[str, Any]:
        """Serialize a card with its node data and assignments."""
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
        
        return {
            "id": str(card.id),
            "node_id": str(card.node_id),
            "session_id": str(card.session_id),
            "node_title": node.question if node else "Unknown",
            "node_description": node.answer if node else None,
            "node_type": node.node_type.value if node else "feature",
            "status": card.status.value,
            "priority": card.priority.value,
            "due_date": card.due_date.isoformat() if card.due_date else None,
            "estimated_hours": card.estimated_hours,
            "assignments": assignment_list,
            "completed_at": card.completed_at.isoformat() if card.completed_at else None,
            "created_at": card.created_at.isoformat(),
            "updated_at": card.updated_at.isoformat(),
        }


# Global instance
planning_service = PlanningService()
