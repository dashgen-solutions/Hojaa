"""
Authentication & Enterprise API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from uuid import uuid4, UUID
from typing import List, Optional
from pydantic import BaseModel
import re

from app.db.session import get_db
from app.models.database import User, UserRole, Organization, OrgRole, SessionMember
from app.models.schemas import UserRegister, UserLogin, UserResponse, Token, OrganizationResponse
from app.core.auth import create_access_token, get_current_active_user
from app.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


def _slugify(name: str) -> str:
    """Convert org name to url-safe slug."""
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """
    Register a new user.
    If organization_name is provided → creates an Enterprise org + sets user as org owner/admin.
    Otherwise → individual registration.
    """
    try:
        logger.info(f"Attempting to register user with email: {user_data.email}")
        
        existing_user = db.query(User).filter(
            (User.email == user_data.email) | (User.username == user_data.username)
        ).first()
        
        if existing_user:
            if existing_user.email == user_data.email:
                raise HTTPException(status_code=400, detail="Email already registered")
            else:
                raise HTTPException(status_code=400, detail="Username already taken")
        
        user_id = uuid4()
        org = None

        # Enterprise registration: create organization first
        if user_data.organization_name:
            slug = _slugify(user_data.organization_name)
            # Ensure unique slug
            base_slug = slug
            counter = 1
            while db.query(Organization).filter(Organization.slug == slug).first():
                slug = f"{base_slug}-{counter}"
                counter += 1

            org = Organization(
                id=uuid4(),
                name=user_data.organization_name,
                slug=slug,
                industry=user_data.industry,
                size=user_data.company_size,
                website=user_data.website,
                created_by=user_id,
                is_active=True,
            )
            db.add(org)
            db.flush()  # get org.id before creating user

        new_user = User(
            id=user_id,
            email=user_data.email,
            username=user_data.username,
            hashed_password=User.hash_password(user_data.password),
            is_active=True,
            role=UserRole.ADMIN,
            organization_id=org.id if org else None,
            org_role=OrgRole.OWNER if org else OrgRole.MEMBER,
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(f"Registered user: {new_user.id}" + (f" with org: {org.name}" if org else ""))
        return new_user
        
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error during registration: {str(e)}")
        raise HTTPException(status_code=400, detail="Email or username already exists")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error during registration: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during registration")


@router.post("/login", response_model=Token)
async def login_user(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return JWT token.
    
    Args:
        login_data: User login credentials (email, password)
        db: Database session
        
    Returns:
        JWT access token
        
    Raises:
        HTTPException: If credentials are invalid
    """
    try:
        logger.info(f"Login attempt for email: {login_data.email}")
        
        # Find user by email
        user = db.query(User).filter(User.email == login_data.email).first()
        
        if not user:
            logger.warning(f"Login failed: User not found for email {login_data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Verify password
        if not user.verify_password(login_data.password):
            logger.warning(f"Login failed: Invalid password for user {user.id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active
        if not user.is_active:
            logger.warning(f"Login failed: Inactive user {user.id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account is inactive"
            )
        
        # Create access token — include role + org for frontend
        access_token = create_access_token(data={
            "sub": str(user.id),
            "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
            "org_id": str(user.organization_id) if user.organization_id else None,
            "org_role": user.org_role.value if hasattr(user.org_role, 'value') else str(user.org_role),
        })
        
        logger.info(f"Successfully logged in user: {user.id}")
        return {"access_token": access_token, "token_type": "bearer"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login"
        )


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get current user info including organization details."""
    result = {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "is_active": current_user.is_active,
        "role": current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
        "organization_id": str(current_user.organization_id) if current_user.organization_id else None,
        "org_role": current_user.org_role.value if hasattr(current_user.org_role, 'value') else str(current_user.org_role),
        "job_title": current_user.job_title,
        "created_at": current_user.created_at.isoformat(),
    }
    # Include organization details if user belongs to one
    if current_user.organization_id:
        org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
        if org:
            result["organization"] = {
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "logo_url": org.logo_url,
                "industry": org.industry,
                "size": org.size,
                "website": org.website,
                "is_active": org.is_active,
                "created_at": org.created_at.isoformat(),
            }
    return result


@router.post("/logout")
async def logout_user(
    current_user: User = Depends(get_current_active_user)
):
    """
    Logout endpoint (mainly for frontend to clear tokens).
    JWT tokens are stateless, so this is primarily for logging purposes.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Success message
    """
    logger.info(f"User logged out: {current_user.id}")
    return {"message": "Successfully logged out"}


# ─── Enterprise: Organization & Employee Management ─────────


def _require_org_admin(user: User):
    """Raise 403 if user is not an org owner or admin."""
    if not user.organization_id:
        raise HTTPException(status_code=403, detail="You are not part of an organization")
    if user.org_role not in (OrgRole.OWNER, OrgRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only organization owner/admin can perform this action")


class UpdateRoleRequest(BaseModel):
    role: str  # viewer | editor | admin


class CreateEmployeeRequest(BaseModel):
    email: str
    username: str
    password: str
    role: str = "editor"        # global platform role
    org_role: str = "member"    # org role: member | admin
    job_title: Optional[str] = None


class UpdateOrgRequest(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None


class SessionAccessRequest(BaseModel):
    session_ids: List[str]
    role: str = "viewer"  # viewer | editor


# ── Organization Info ──

@router.get("/organization", response_model=OrganizationResponse)
async def get_organization(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get current user's organization details."""
    if not current_user.organization_id:
        raise HTTPException(status_code=404, detail="You are not part of an organization")
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/organization", response_model=OrganizationResponse)
async def update_organization(
    body: UpdateOrgRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update organization details. Owner/admin only."""
    _require_org_admin(current_user)
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if body.name is not None:
        org.name = body.name
    if body.industry is not None:
        org.industry = body.industry
    if body.size is not None:
        org.size = body.size
    if body.website is not None:
        org.website = body.website
    if body.logo_url is not None:
        org.logo_url = body.logo_url
    db.commit()
    db.refresh(org)
    return org


# ── Employee Management (org-scoped) ──

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    search: Optional[str] = Query(None, description="Search by email or username"),
    role_filter: Optional[str] = Query(None, alias="role", description="Filter by role"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List users in the same organization.
    Supports search by email/username and filter by role.
    Owner/admin only.
    """
    _require_org_admin(current_user)
    query = db.query(User).filter(User.organization_id == current_user.organization_id)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_term)) | (User.username.ilike(search_term))
        )
    if role_filter:
        try:
            query = query.filter(User.role == UserRole(role_filter))
        except ValueError:
            pass  # ignore invalid filter

    return query.order_by(User.created_at).all()


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_employee(
    body: CreateEmployeeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Add an employee to your organization."""
    _require_org_admin(current_user)

    # Validate roles
    try:
        new_role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")
    try:
        new_org_role = OrgRole(body.org_role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid org_role: {body.org_role}")

    # Only org owner can create admin-level users
    if new_org_role == OrgRole.OWNER:
        raise HTTPException(status_code=403, detail="Cannot create another owner")
    if new_org_role == OrgRole.ADMIN and current_user.org_role != OrgRole.OWNER:
        raise HTTPException(status_code=403, detail="Only org owner can create admins")

    # Check duplicates
    existing = db.query(User).filter(
        (User.email == body.email) | (User.username == body.username)
    ).first()
    if existing:
        if existing.email == body.email:
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = User(
        id=uuid4(),
        email=body.email,
        username=body.username,
        hashed_password=User.hash_password(body.password),
        is_active=True,
        role=new_role,
        organization_id=current_user.organization_id,
        org_role=new_org_role,
        job_title=body.job_title,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(f"Employee {new_user.id} added to org {current_user.organization_id} by {current_user.id}")
    return new_user


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    body: UpdateRoleRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Change an employee's role. Owner/admin only, within same org."""
    _require_org_admin(current_user)

    try:
        new_role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")

    target = db.query(User).filter(
        User.id == user_id,
        User.organization_id == current_user.organization_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found in your organization")

    target.role = new_role
    db.commit()
    db.refresh(target)
    logger.info(f"User {target.id} role → {new_role.value} by {current_user.id}")
    return target


@router.delete("/users/{user_id}", status_code=200)
async def delete_employee(
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Remove an employee from your organization. Owner/admin only."""
    _require_org_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    target = db.query(User).filter(
        User.id == user_id,
        User.organization_id == current_user.organization_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found in your organization")

    # Prevent deleting org owner
    if target.org_role == OrgRole.OWNER:
        raise HTTPException(status_code=403, detail="Cannot delete the organization owner")

    db.delete(target)
    db.commit()
    logger.info(f"Employee {user_id} deleted from org by {current_user.id}")
    return {"message": f"Employee {target.username} removed"}


@router.patch("/users/{user_id}/toggle-active", response_model=UserResponse)
async def toggle_employee_active(
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Enable/disable an employee account. Owner/admin only."""
    _require_org_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    target = db.query(User).filter(
        User.id == user_id,
        User.organization_id == current_user.organization_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found in your organization")

    target.is_active = not target.is_active
    db.commit()
    db.refresh(target)
    return target


# ── Session Access Management ──

@router.post("/users/{user_id}/session-access")
async def grant_session_access(
    user_id: UUID,
    body: SessionAccessRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Grant an employee access to specific sessions.
    This creates SessionMember entries so the employee can see those sessions.
    """
    _require_org_admin(current_user)

    target = db.query(User).filter(
        User.id == user_id,
        User.organization_id == current_user.organization_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found in your organization")

    try:
        share_role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")

    from app.models.database import Session as DBSession, TeamMember
    granted = []
    for sid_str in body.session_ids:
        try:
            sid = UUID(sid_str)
        except ValueError:
            continue
        # Verify session belongs to this org
        session = db.query(DBSession).filter(DBSession.id == sid).first()
        if not session:
            continue
        # Only allow granting access to sessions owned by org members
        if session.organization_id != current_user.organization_id:
            continue

        existing = db.query(SessionMember).filter(
            SessionMember.session_id == sid,
            SessionMember.user_id == target.id,
        ).first()
        if existing:
            existing.role = share_role
        else:
            db.add(SessionMember(
                session_id=sid,
                user_id=target.id,
                role=share_role,
                invited_by=current_user.id,
            ))

        # Auto-add as team member on the planning board
        existing_tm = db.query(TeamMember).filter(
            TeamMember.session_id == sid,
            TeamMember.email == target.email,
        ).first()
        if not existing_tm:
            import random
            colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6']
            db.add(TeamMember(
                session_id=sid,
                name=target.username,
                email=target.email,
                role=share_role.value if hasattr(share_role, 'value') else str(share_role),
                avatar_color=random.choice(colors),
            ))

        granted.append(sid_str)

    db.commit()
    return {"message": f"Access granted to {len(granted)} session(s)", "sessions": granted}


@router.delete("/users/{user_id}/session-access/{session_id}")
async def revoke_session_access(
    user_id: UUID,
    session_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Revoke an employee's access to a specific session."""
    _require_org_admin(current_user)

    member = db.query(SessionMember).filter(
        SessionMember.session_id == session_id,
        SessionMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Access entry not found")

    # Also remove from planning board team members
    from app.models.database import TeamMember
    target = db.query(User).filter(User.id == user_id).first()
    if target:
        tm = db.query(TeamMember).filter(
            TeamMember.session_id == session_id,
            TeamMember.email == target.email,
        ).first()
        if tm:
            db.delete(tm)

    db.delete(member)
    db.commit()
    return {"message": "Session access revoked"}


@router.get("/users/{user_id}/session-access")
async def get_user_session_access(
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get list of sessions an employee has access to."""
    _require_org_admin(current_user)

    target = db.query(User).filter(
        User.id == user_id,
        User.organization_id == current_user.organization_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found in your organization")

    from app.models.database import Session as DBSession
    memberships = db.query(SessionMember).filter(SessionMember.user_id == target.id).all()
    result = []
    for m in memberships:
        s = db.query(DBSession).filter(DBSession.id == m.session_id).first()
        if s:
            result.append({
                "session_id": str(s.id),
                "session_name": s.document_filename or "Untitled",
                "role": m.role.value if hasattr(m.role, 'value') else str(m.role),
                "created_at": s.created_at.isoformat(),
            })
    return {"sessions": result}
