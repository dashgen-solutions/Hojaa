"""
API routes for source ingestion and suggestion management.
Phase 1: Meeting Notes Integration.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_optional_user
from app.models.database import (
    Source, SourceSuggestion, SourceType, User
)
from app.models.schemas import (
    SourceIngestRequest, SourceResponse, SourceDetailResponse,
    SuggestionResponse, SuggestionApplyRequest, BulkSuggestionApplyRequest,
    SuccessResponse,
)
from app.services.meeting_notes_parser import meeting_notes_parser
from app.services.graph_service import graph_service
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/sources", tags=["sources"])


@router.post("/ingest", response_model=SourceDetailResponse)
async def ingest_source(
    request: SourceIngestRequest,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Ingest a source (meeting notes, document, manual note).
    AI analyzes the content and generates scope change suggestions.
    """
    try:
        # Create source record
        source = Source(
            session_id=request.session_id,
            source_type=SourceType(request.source_type),
            source_name=request.source_name,
            raw_content=request.raw_content,
            source_metadata=request.source_metadata or {},
            created_by=current_user.id if current_user else None,
        )
        database.add(source)
        database.commit()
        database.refresh(source)
        
        logger.info(f"Created source '{source.source_name}' for session {request.session_id}")
        
        # Run AI analysis
        suggestions = await meeting_notes_parser.analyze_source(source.id, database)
        
        # Build response
        suggestion_responses = []
        for suggestion in suggestions:
            suggestion_responses.append({
                "id": str(suggestion.id),
                "source_id": str(suggestion.source_id),
                "change_type": suggestion.change_type,
                "target_node_id": str(suggestion.target_node_id) if suggestion.target_node_id else None,
                "parent_node_id": str(suggestion.parent_node_id) if suggestion.parent_node_id else None,
                "title": suggestion.title,
                "description": suggestion.description,
                "acceptance_criteria": suggestion.acceptance_criteria or [],
                "confidence": suggestion.confidence,
                "reasoning": suggestion.reasoning,
                "source_quote": suggestion.source_quote,
                "is_approved": suggestion.is_approved,
            })
        
        return {
            "id": str(source.id),
            "session_id": str(source.session_id),
            "source_type": source.source_type.value,
            "source_name": source.source_name,
            "raw_content": source.raw_content,
            "processed_summary": source.processed_summary,
            "is_processed": source.is_processed,
            "source_metadata": source.source_metadata,
            "suggestions": suggestion_responses,
            "created_at": source.created_at,
        }
        
    except Exception as error:
        logger.error(f"Error ingesting source: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/{session_id}", response_model=list)
async def list_sources(
    session_id: str,
    database: Session = Depends(get_db),
):
    """List all sources for a session with suggestion counts."""
    try:
        sources = (
            database.query(Source)
            .filter(Source.session_id == session_id)
            .order_by(Source.created_at.desc())
            .all()
        )
        
        result = []
        for source in sources:
            suggestions = (
                database.query(SourceSuggestion)
                .filter(SourceSuggestion.source_id == source.id)
                .all()
            )
            
            approved_count = sum(1 for s in suggestions if s.is_approved is True)
            rejected_count = sum(1 for s in suggestions if s.is_approved is False)
            pending_count = sum(1 for s in suggestions if s.is_approved is None)
            
            result.append({
                "id": str(source.id),
                "session_id": str(source.session_id),
                "source_type": source.source_type.value,
                "source_name": source.source_name,
                "is_processed": source.is_processed,
                "processed_summary": source.processed_summary,
                "source_metadata": source.source_metadata,
                "suggestions_count": len(suggestions),
                "approved_count": approved_count,
                "rejected_count": rejected_count,
                "pending_count": pending_count,
                "created_at": source.created_at,
            })
        
        return result
        
    except Exception as error:
        logger.error(f"Error listing sources: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/detail/{source_id}")
async def get_source_detail(
    source_id: str,
    database: Session = Depends(get_db),
):
    """Get a source with all its suggestions."""
    try:
        source = database.query(Source).filter(Source.id == source_id).first()
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        
        suggestions = (
            database.query(SourceSuggestion)
            .filter(SourceSuggestion.source_id == source.id)
            .order_by(SourceSuggestion.confidence.desc())
            .all()
        )
        
        suggestion_list = []
        for suggestion in suggestions:
            suggestion_list.append({
                "id": str(suggestion.id),
                "source_id": str(suggestion.source_id),
                "change_type": suggestion.change_type,
                "target_node_id": str(suggestion.target_node_id) if suggestion.target_node_id else None,
                "parent_node_id": str(suggestion.parent_node_id) if suggestion.parent_node_id else None,
                "title": suggestion.title,
                "description": suggestion.description,
                "acceptance_criteria": suggestion.acceptance_criteria or [],
                "confidence": suggestion.confidence,
                "reasoning": suggestion.reasoning,
                "source_quote": suggestion.source_quote,
                "is_approved": suggestion.is_approved,
            })
        
        return {
            "id": str(source.id),
            "session_id": str(source.session_id),
            "source_type": source.source_type.value,
            "source_name": source.source_name,
            "raw_content": source.raw_content,
            "processed_summary": source.processed_summary,
            "is_processed": source.is_processed,
            "source_metadata": source.source_metadata,
            "suggestions": suggestion_list,
            "created_at": source.created_at,
        }
        
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting source detail: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/apply", response_model=SuccessResponse)
async def apply_suggestions(
    request: BulkSuggestionApplyRequest,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Apply (approve/reject) a batch of suggestions.
    Approved suggestions modify the graph with full source attribution.
    """
    try:
        applied_nodes = []
        rejected_count = 0
        
        for decision in request.decisions:
            result = graph_service.apply_suggestion(
                database=database,
                suggestion_id=decision.suggestion_id,
                is_approved=decision.is_approved,
                approved_by=current_user.id if current_user else None,
                edited_title=decision.edited_title,
                edited_description=decision.edited_description,
            )
            
            if result:
                applied_nodes.append(result)
            elif not decision.is_approved:
                rejected_count += 1
        
        message = f"Applied {len(applied_nodes)} changes, rejected {rejected_count} suggestions"
        logger.info(message)
        
        return SuccessResponse(
            success=True,
            message=message,
            data={
                "applied_count": len(applied_nodes),
                "rejected_count": rejected_count,
                "applied_nodes": applied_nodes,
            },
        )
        
    except Exception as error:
        logger.error(f"Error applying suggestions: {str(error)}")
        raise HTTPException(status_code=500, detail=str(error))
