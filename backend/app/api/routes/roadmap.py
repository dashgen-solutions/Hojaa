"""
Public Roadmap, Feature Requests & Feedback API.

Public endpoints (no auth):
  GET  /api/roadmap/items          — list public roadmap items
  GET  /api/roadmap/requests       — list feature requests
  GET  /api/roadmap/stats          — public stats

Auth-required:
  POST /api/roadmap/items/{id}/vote      — toggle vote on roadmap item
  POST /api/roadmap/requests             — submit feature request
  POST /api/roadmap/requests/{id}/vote   — toggle vote on feature request
  POST /api/roadmap/feedback             — submit feedback

Admin-only:
  POST   /api/roadmap/items              — create roadmap item
  PUT    /api/roadmap/items/{id}         — update roadmap item
  DELETE /api/roadmap/items/{id}         — delete roadmap item
  PUT    /api/roadmap/requests/{id}/status — update request status
  POST   /api/roadmap/requests/{id}/promote — promote to roadmap
  GET    /api/roadmap/feedback           — list all feedback
  POST   /api/roadmap/admin/seed         — seed roadmap data
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_optional_user
from app.db.session import get_db
from app.models.database import (
    User, UserRole,
    RoadmapItem, RoadmapStatus, RoadmapCategory,
    FeatureRequest, FeatureRequestStatus,
    RoadmapVote, FeatureRequestVote,
    Feedback, FeedbackType,
)

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


# ── Schemas ──

class RoadmapItemOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    category: str
    status: str
    is_public: bool
    order_index: int
    icon_name: Optional[str] = None
    inspired_by: Optional[str] = None
    vote_count: int = 0
    user_has_voted: bool = False
    shipped_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RoadmapItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: str
    status: str = "planned"
    is_public: bool = True
    order_index: int = 0
    icon_name: Optional[str] = None
    inspired_by: Optional[str] = None


class RoadmapItemUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    is_public: Optional[bool] = None
    order_index: Optional[int] = None
    icon_name: Optional[str] = None
    inspired_by: Optional[str] = None


class FeatureRequestOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    status: str
    vote_count: int
    user_has_voted: bool = False
    user_display_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FeatureRequestCreate(BaseModel):
    text: str = Field(..., min_length=10, max_length=2000)


class FeedbackCreate(BaseModel):
    feedback_type: str = "idea"
    content: str = Field(..., min_length=5, max_length=5000)
    email: Optional[str] = None


class FeedbackOut(BaseModel):
    id: UUID
    feedback_type: str
    content: str
    email: Optional[str] = None
    is_read: bool
    admin_note: Optional[str] = None
    user_display_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StatsOut(BaseModel):
    planned: int
    in_progress: int
    shipped: int
    total_votes: int
    total_requests: int


class VoteResponse(BaseModel):
    voted: bool
    vote_count: int


class StatusUpdate(BaseModel):
    status: str


class PromoteBody(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: str
    status: str = "planned"


# ── Helpers ──

def _require_admin(user: User):
    if user.role not in (UserRole.OWNER, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


def _roadmap_item_to_out(item: RoadmapItem, user_voted_ids: set) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "category": item.category.value if item.category else None,
        "status": item.status.value if item.status else None,
        "is_public": item.is_public,
        "order_index": item.order_index,
        "icon_name": item.icon_name,
        "inspired_by": item.inspired_by,
        "vote_count": len(item.votes),
        "user_has_voted": item.id in user_voted_ids,
        "shipped_at": item.shipped_at,
        "created_at": item.created_at,
    }


def _feature_request_to_out(req: FeatureRequest, user_voted_ids: set) -> dict:
    return {
        "id": req.id,
        "title": req.title,
        "description": req.description,
        "status": req.status.value if req.status else None,
        "vote_count": req.vote_count,
        "user_has_voted": req.id in user_voted_ids,
        "user_display_name": req.user.username if req.user else None,
        "created_at": req.created_at,
    }


def _condense_text(text: str) -> tuple:
    """Simple condensation: first sentence as title, rest as description."""
    text = text.strip()
    # Split on first period, question mark, or newline
    for sep in ['. ', '? ', '! ', '\n']:
        if sep in text:
            idx = text.index(sep)
            title = text[:idx + 1].strip()[:255]
            desc = text[idx + 1:].strip()[:500] or None
            return title, desc
    return text[:255], None


# ── Public Endpoints ──

@router.get("/items")
def list_roadmap_items(
    category: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    query = db.query(RoadmapItem).filter(RoadmapItem.is_public == True)

    if category:
        query = query.filter(RoadmapItem.category == category)
    if status_filter:
        query = query.filter(RoadmapItem.status == status_filter)

    query = query.order_by(RoadmapItem.category, RoadmapItem.order_index)
    items = query.all()

    user_voted_ids = set()
    if current_user:
        user_votes = db.query(RoadmapVote.roadmap_item_id).filter(
            RoadmapVote.user_id == current_user.id
        ).all()
        user_voted_ids = {v[0] for v in user_votes}

    return [_roadmap_item_to_out(item, user_voted_ids) for item in items]


@router.get("/requests")
def list_feature_requests(
    sort: str = Query("votes", regex="^(votes|newest)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    query = db.query(FeatureRequest).filter(
        FeatureRequest.status.in_([
            FeatureRequestStatus.PENDING,
            FeatureRequestStatus.UNDER_REVIEW,
            FeatureRequestStatus.ACCEPTED,
        ])
    )

    if sort == "votes":
        query = query.order_by(FeatureRequest.vote_count.desc(), FeatureRequest.created_at.desc())
    else:
        query = query.order_by(FeatureRequest.created_at.desc())

    total = query.count()
    requests = query.offset((page - 1) * limit).limit(limit).all()

    user_voted_ids = set()
    if current_user:
        user_votes = db.query(FeatureRequestVote.feature_request_id).filter(
            FeatureRequestVote.user_id == current_user.id
        ).all()
        user_voted_ids = {v[0] for v in user_votes}

    return {
        "items": [_feature_request_to_out(req, user_voted_ids) for req in requests],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    planned = db.query(RoadmapItem).filter(
        RoadmapItem.is_public == True, RoadmapItem.status == RoadmapStatus.PLANNED
    ).count()
    in_progress = db.query(RoadmapItem).filter(
        RoadmapItem.is_public == True, RoadmapItem.status == RoadmapStatus.IN_PROGRESS
    ).count()
    shipped = db.query(RoadmapItem).filter(
        RoadmapItem.is_public == True, RoadmapItem.status == RoadmapStatus.SHIPPED
    ).count()
    total_votes = (
        db.query(func.count(RoadmapVote.id)).scalar() +
        db.query(func.count(FeatureRequestVote.id)).scalar()
    )
    total_requests = db.query(FeatureRequest).count()

    return StatsOut(
        planned=planned,
        in_progress=in_progress,
        shipped=shipped,
        total_votes=total_votes,
        total_requests=total_requests,
    )


# ── Auth-Required Endpoints ──

@router.post("/items/{item_id}/vote")
def toggle_roadmap_vote(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(RoadmapItem).filter(RoadmapItem.id == item_id, RoadmapItem.is_public == True).first()
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")

    existing = db.query(RoadmapVote).filter(
        RoadmapVote.roadmap_item_id == item_id,
        RoadmapVote.user_id == current_user.id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        vote_count = db.query(RoadmapVote).filter(RoadmapVote.roadmap_item_id == item_id).count()
        return VoteResponse(voted=False, vote_count=vote_count)
    else:
        vote = RoadmapVote(roadmap_item_id=item_id, user_id=current_user.id)
        db.add(vote)
        db.commit()
        vote_count = db.query(RoadmapVote).filter(RoadmapVote.roadmap_item_id == item_id).count()
        return VoteResponse(voted=True, vote_count=vote_count)


@router.post("/requests")
def submit_feature_request(
    body: FeatureRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title, description = _condense_text(body.text)

    req = FeatureRequest(
        user_id=current_user.id,
        title=title,
        description=description,
        original_text=body.text,
        vote_count=1,  # auto-upvote by submitter
    )
    db.add(req)
    db.flush()

    # Auto-upvote by submitter
    vote = FeatureRequestVote(feature_request_id=req.id, user_id=current_user.id)
    db.add(vote)
    db.commit()
    db.refresh(req)

    return _feature_request_to_out(req, {req.id})


@router.post("/requests/{request_id}/vote")
def toggle_feature_request_vote(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = db.query(FeatureRequest).filter(FeatureRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Feature request not found")

    existing = db.query(FeatureRequestVote).filter(
        FeatureRequestVote.feature_request_id == request_id,
        FeatureRequestVote.user_id == current_user.id,
    ).first()

    if existing:
        db.delete(existing)
        req.vote_count = max(0, req.vote_count - 1)
        db.commit()
        return VoteResponse(voted=False, vote_count=req.vote_count)
    else:
        vote = FeatureRequestVote(feature_request_id=request_id, user_id=current_user.id)
        db.add(vote)
        req.vote_count = req.vote_count + 1
        db.commit()
        return VoteResponse(voted=True, vote_count=req.vote_count)


@router.post("/feedback")
def submit_feedback(
    body: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    fb = Feedback(
        user_id=current_user.id if current_user else None,
        email=body.email if not current_user else (current_user.email if current_user else None),
        feedback_type=FeedbackType(body.feedback_type),
        content=body.content,
    )
    db.add(fb)
    db.commit()
    return {"message": "Thank you for your feedback!"}


# ── Admin Endpoints ──

@router.post("/items", status_code=201)
def create_roadmap_item(
    body: RoadmapItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    item = RoadmapItem(
        title=body.title,
        description=body.description,
        category=RoadmapCategory(body.category),
        status=RoadmapStatus(body.status),
        is_public=body.is_public,
        order_index=body.order_index,
        icon_name=body.icon_name,
        inspired_by=body.inspired_by,
        shipped_at=datetime.utcnow() if body.status == "shipped" else None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _roadmap_item_to_out(item, set())


@router.put("/items/{item_id}")
def update_roadmap_item(
    item_id: UUID,
    body: RoadmapItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    item = db.query(RoadmapItem).filter(RoadmapItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")

    update_data = body.dict(exclude_unset=True)
    if "category" in update_data and update_data["category"]:
        update_data["category"] = RoadmapCategory(update_data["category"])
    if "status" in update_data and update_data["status"]:
        new_status = RoadmapStatus(update_data["status"])
        update_data["status"] = new_status
        if new_status == RoadmapStatus.SHIPPED and not item.shipped_at:
            update_data["shipped_at"] = datetime.utcnow()

    for key, value in update_data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return _roadmap_item_to_out(item, set())


@router.delete("/items/{item_id}", status_code=204)
def delete_roadmap_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    item = db.query(RoadmapItem).filter(RoadmapItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")

    db.delete(item)
    db.commit()


@router.put("/requests/{request_id}/status")
def update_request_status(
    request_id: UUID,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    req = db.query(FeatureRequest).filter(FeatureRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Feature request not found")

    req.status = FeatureRequestStatus(body.status)
    db.commit()
    return {"status": req.status.value}


@router.post("/requests/{request_id}/promote")
def promote_request(
    request_id: UUID,
    body: PromoteBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    req = db.query(FeatureRequest).filter(FeatureRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Feature request not found")

    item = RoadmapItem(
        title=body.title or req.title,
        description=body.description or req.description,
        category=RoadmapCategory(body.category),
        status=RoadmapStatus(body.status),
        feature_request_id=req.id,
    )
    db.add(item)
    req.status = FeatureRequestStatus.ACCEPTED
    req.promoted_to_roadmap_id = item.id
    db.commit()
    db.refresh(item)
    return _roadmap_item_to_out(item, set())


@router.get("/feedback")
def list_feedback(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    query = db.query(Feedback).order_by(Feedback.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    return {
        "items": [
            {
                "id": fb.id,
                "feedback_type": fb.feedback_type.value if fb.feedback_type else None,
                "content": fb.content,
                "email": fb.email,
                "is_read": fb.is_read,
                "admin_note": fb.admin_note,
                "user_display_name": fb.user.username if fb.user else None,
                "created_at": fb.created_at,
            }
            for fb in items
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/admin/seed")
def seed_roadmap(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    from app.services.roadmap_service import seed_roadmap_items
    count = seed_roadmap_items(db)
    return {"message": f"Seeded {count} roadmap items"}
