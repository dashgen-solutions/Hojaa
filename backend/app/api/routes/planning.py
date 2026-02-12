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
)
from app.services.planning_service import planning_service
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/planning", tags=["planning"])


# ===== Board =====

@router.get("/{session_id}")
async def get_planning_board(
    session_id: str,
    database: Session = Depends(get_db),
):
    """Get the full planning board with all columns, cards, and team members."""
    try:
        board = planning_service.get_board(
            database=database,
            session_id=session_id,
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
        card = planning_service.create_card(
            database=database,
            node_id=request.node_id,
            session_id=request.session_id,
            priority=request.priority or "medium",
            due_date=request.due_date,
            created_by=current_user.id if current_user else None,
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
    """Assign a team member to a card."""
    try:
        card = planning_service.assign_card(
            database=database,
            card_id=card_id,
            team_member_id=request.team_member_id,
            role=request.role or "assignee",
            assigned_by=current_user.id if current_user else None,
        )
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
        planning_service.delete_team_member(
            database=database,
            team_member_id=team_member_id,
        )
        return SuccessResponse(message="Team member removed")
        
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.error(f"Error deleting team member: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))
