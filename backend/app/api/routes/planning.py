"""
API routes for the lightweight planning board.
Phase 4: Planning Board with Kanban, assignments, and team management.
"""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_optional_user
from app.models.database import User
from app.models.schemas import (
    CardCreate, CardUpdate, AssignmentCreate, TeamMemberCreate,
    BulkCardCreate, SuccessResponse,
    AcceptanceCriterionCreate, AcceptanceCriterionUpdate,
    CardCommentCreate,
)
from app.services.planning_service import planning_service
from app.services.notification_service import notification_service
from app.services.project_channel_service import sync_team_member
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/planning", tags=["planning"])


# ===== Board =====

@router.get("/{session_id}")
async def get_planning_board(
    session_id: str,
    assignee: Optional[str] = Query(None, description="Filter cards by team member ID"),
    database: Session = Depends(get_db),
):
    """Get the full planning board with all columns, cards, and team members."""
    try:
        board = planning_service.get_board(
            database=database,
            session_id=session_id,
            assignee_filter=UUID(assignee) if assignee else None,
        )
        return board
        
    except Exception as error:
        logger.error(f"Error getting planning board: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Cards =====

@router.post("/cards")
async def create_card(
    request: CardCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """Create a planning card from a graph node."""
    try:
        card = await planning_service.create_card(
            database=database,
            node_id=request.node_id,
            session_id=request.session_id,
            priority=request.priority or "medium",
            due_date=request.due_date,
            created_by=current_user.id if current_user else None,
            title=request.title,
            description=request.description,
            is_out_of_scope=request.is_out_of_scope,
        )
        return card
        
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        logger.error(f"Error creating card: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/cards/bulk")
async def bulk_create_cards(
    request: BulkCardCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """Bulk create cards from graph nodes by type."""
    try:
        cards = planning_service.bulk_create_cards(
            database=database,
            session_id=request.session_id,
            node_types=request.node_types,
            include_details=request.include_details,
            created_by=current_user.id if current_user else None,
        )
        return {
            "success": True,
            "message": f"Created {len(cards)} cards",
            "cards": cards,
        }
        
    except Exception as error:
        logger.error(f"Error bulk creating cards: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.delete("/cards/{card_id}")
async def delete_card(
    card_id: str,
    database: Session = Depends(get_db),
):
    """Delete a planning card and all its related data."""
    try:
        planning_service.delete_card(
            database=database,
            card_id=UUID(card_id),
        )
        return SuccessResponse(message="Card deleted")
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error deleting card: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.patch("/cards/{card_id}")
async def update_card(
    card_id: str,
    request: CardUpdate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """Update a planning card (status, priority, due date, etc.)."""
    try:
        card = planning_service.update_card(
            database=database,
            card_id=card_id,
            status=request.status,
            priority=request.priority,
            due_date=request.due_date,
            estimated_hours=request.estimated_hours,
            actual_hours=request.actual_hours,
            title=request.title,
            description=request.description,
            updated_by=current_user.id if current_user else None,
        )
        return card
        
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error updating card: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/cards/{card_id}/assign")
async def assign_card(
    card_id: str,
    request: AssignmentCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """Assign a team member to a card. Sends email notification to assignee if configured."""
    try:
        card = planning_service.assign_card(
            database=database,
            card_id=card_id,
            team_member_id=request.team_member_id,
            role=request.role or "assignee",
            assigned_by=current_user.id if current_user else None,
        )
        # Notify assignee by email (Mailchimp) — non-blocking
        try:
            notification_service.notify_card_assignment(
                db=database,
                session_id=UUID(card["session_id"]),
                card_id=UUID(card_id),
                team_member_id=UUID(request.team_member_id),
                assigned_by=current_user.id if current_user else None,
            )
        except Exception as notif_err:
            logger.warning(f"Card assignment notification failed (assignment succeeded): {notif_err}")
        return card

    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error assigning card: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.delete("/cards/{card_id}/assign/{team_member_id}")
async def remove_card_assignment(
    card_id: str,
    team_member_id: str,
    database: Session = Depends(get_db),
):
    """Remove a team member assignment from a card."""
    try:
        planning_service.remove_assignment(
            database=database,
            card_id=card_id,
            team_member_id=team_member_id,
        )
        return SuccessResponse(message="Assignment removed")
        
    except Exception as error:
        logger.error(f"Error removing assignment: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Team Members =====

@router.get("/team/{session_id}")
async def get_team_members(
    session_id: str,
    database: Session = Depends(get_db),
):
    """Get all team members for a session."""
    try:
        members = planning_service.get_team_members(
            database=database,
            session_id=session_id,
        )
        return members
        
    except Exception as error:
        logger.error(f"Error getting team members: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/team")
async def add_team_member(
    request: TeamMemberCreate,
    session_id: str = Query(..., description="Session to add the team member to"),
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """Add a team member to a session."""
    try:
        member = planning_service.add_team_member(
            database=database,
            session_id=session_id,
            name=request.name,
            email=request.email,
            role=request.role,
        )

        # Sync: add team member to project channel (if their email is a registered user)
        try:
            sync_team_member(database, UUID(session_id), request.email, remove=False)
            database.commit()
        except Exception as ch_err:
            logger.warning(f"Channel sync on team-add failed: {ch_err}")

        # Notify subscribed users + welcome email to new member
        try:
            notification_service.notify_team_member_added(
                db=database,
                session_id=UUID(session_id),
                member_name=request.name,
                member_email=request.email,
                member_role=request.role or "member",
                added_by=current_user.id if current_user else None,
            )
        except Exception as notif_err:
            logger.warning(f"Team member notification failed (member added OK): {notif_err}")
        return member
        
    except Exception as error:
        logger.error(f"Error adding team member: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.delete("/team/{team_member_id}")
async def delete_team_member(
    team_member_id: str,
    database: Session = Depends(get_db),
):
    """Delete a team member and their assignments."""
    try:
        # Fetch member before deletion so we can get session_id + email for channel sync
        from app.models.database import TeamMember
        member_obj = database.query(TeamMember).filter(TeamMember.id == UUID(team_member_id)).first()
        member_session_id = member_obj.session_id if member_obj else None
        member_email = member_obj.email if member_obj else None

        planning_service.delete_team_member(
            database=database,
            team_member_id=team_member_id,
        )

        # Sync: remove team member from project channel
        if member_session_id and member_email:
            try:
                sync_team_member(database, member_session_id, member_email, remove=True)
                database.commit()
            except Exception as ch_err:
                logger.warning(f"Channel sync on team-remove failed: {ch_err}")

        return SuccessResponse(message="Team member removed")
        
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error deleting team member: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Acceptance Criteria =====

@router.post("/cards/{card_id}/ac")
async def add_acceptance_criterion(
    card_id: str,
    request: AcceptanceCriterionCreate,
    database: Session = Depends(get_db),
):
    """Add an acceptance criterion to a card."""
    try:
        ac = planning_service.add_acceptance_criterion(
            database=database,
            card_id=UUID(card_id),
            description=request.description,
            node_id=request.node_id,
        )
        return ac
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error adding AC: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.patch("/ac/{criterion_id}")
async def update_acceptance_criterion(
    criterion_id: str,
    request: AcceptanceCriterionUpdate,
    database: Session = Depends(get_db),
):
    """Update / toggle an acceptance criterion."""
    try:
        ac = planning_service.update_acceptance_criterion(
            database=database,
            criterion_id=UUID(criterion_id),
            description=request.description,
            is_completed=request.is_completed,
        )
        return ac
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error updating AC: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.delete("/ac/{criterion_id}")
async def delete_acceptance_criterion(
    criterion_id: str,
    database: Session = Depends(get_db),
):
    """Delete an acceptance criterion."""
    try:
        ok = planning_service.delete_acceptance_criterion(
            database=database,
            criterion_id=UUID(criterion_id),
        )
        if not ok:
            raise HTTPException(status_code=404, detail="Criterion not found")
        return SuccessResponse(message="Acceptance criterion deleted")
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error deleting AC: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Comments / Notes =====

@router.post("/cards/{card_id}/comments")
async def add_card_comment(
    card_id: str,
    request: CardCommentCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """Add a comment / note to a card."""
    try:
        comment = planning_service.add_comment(
            database=database,
            card_id=UUID(card_id),
            content=request.content,
            author_id=current_user.id if current_user else None,
        )
        return comment
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error adding comment: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/cards/{card_id}/comments")
async def get_card_comments(
    card_id: str,
    database: Session = Depends(get_db),
):
    """Get all comments for a card."""
    try:
        return planning_service.get_card_comments(
            database=database,
            card_id=UUID(card_id),
        )
    except Exception as error:
        logger.error(f"Error getting comments: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Workload =====

@router.get("/workload/{session_id}")
async def get_workload(
    session_id: str,
    database: Session = Depends(get_db),
):
    """Get workload summary per team member."""
    try:
        return planning_service.get_workload(
            database=database,
            session_id=UUID(session_id),
        )
    except Exception as error:
        logger.error(f"Error getting workload: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== Out of Scope =====

@router.post("/cards/{card_id}/add-to-graph")
async def add_out_of_scope_to_graph(
    card_id: str,
    parent_node_id: str = Query(..., description="Parent node ID to attach the new node under"),
    database: Session = Depends(get_db),
):
    """Convert an out-of-scope card into a graph node."""
    try:
        card = planning_service.add_out_of_scope_to_graph(
            database=database,
            card_id=UUID(card_id),
            parent_node_id=parent_node_id,
        )
        return card
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        logger.error(f"Error converting out-of-scope card: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


# ===== AI-3.3: AI-powered Acceptance Criteria Generation =====

@router.post("/cards/{card_id}/generate-ac")
async def generate_acceptance_criteria(
    card_id: str,
    database: Session = Depends(get_db),
):
    """AI-generate acceptance criteria for a planning card's linked node."""
    try:
        from app.models.database import Card
        card = database.query(Card).filter(Card.id == UUID(card_id)).first()
        if not card or not card.node_id:
            raise HTTPException(status_code=404, detail="Card not found or has no linked node")

        from app.services.ai_features_service import generate_acceptance_criteria as _gen_ac
        criteria = await _gen_ac(database, UUID(card.node_id))
        return {"acceptance_criteria": criteria}
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error generating AC: {error}")
        raise HTTPException(status_code=500, detail=str(error))
