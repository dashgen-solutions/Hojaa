"""
18.2-D  Public API — API Key management service.

Provides:
- Key generation (``mk_<random-32-hex>``)
- SHA-256 hashing (only hash is persisted)
- Key verification / lookup
- Scoped permission checking
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.models.database import APIKey, APIKeyScope, User

logger = get_logger(__name__)

# Key format: mk_<32 hex chars>  → 35 chars total
_KEY_PREFIX = "mk_"
_KEY_RANDOM_BYTES = 32  # 32 bytes = 64 hex chars


def generate_api_key() -> Tuple[str, str, str]:
    """Generate a new API key.

    Returns:
        (raw_key, key_prefix, key_hash)
        - ``raw_key`` is shown once to the user.
        - ``key_prefix`` is the first 8 chars for identification.
        - ``key_hash`` is SHA-256 hex digest stored in the database.
    """
    random_part = secrets.token_hex(_KEY_RANDOM_BYTES)
    raw_key = f"{_KEY_PREFIX}{random_part}"
    key_prefix = raw_key[:8]
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    return raw_key, key_prefix, key_hash


def hash_key(raw_key: str) -> str:
    """Hash a raw API key for lookup."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


def create_api_key(
    db: Session,
    *,
    organization_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    name: str,
    scopes: Optional[List[str]] = None,
    expires_at: Optional[datetime] = None,
) -> Tuple[str, APIKey]:
    """Create a new API key and persist its hash.

    Keys can be org-scoped, user-scoped, or both.

    Returns:
        (raw_key, api_key_row)  — raw_key is shown once.
    """
    raw_key, prefix, key_hash_val = generate_api_key()

    row = APIKey(
        organization_id=organization_id,
        user_id=user_id,
        name=name,
        key_prefix=prefix,
        key_hash=key_hash_val,
        scopes=scopes or [APIKeyScope.FULL_ACCESS.value],
        expires_at=expires_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    logger.info(f"API key created: name={name} prefix={prefix} org={organization_id} user={user_id}")
    return raw_key, row


def verify_api_key(db: Session, raw_key: str) -> Optional[APIKey]:
    """Look up an API key by its SHA-256 hash. Returns the row or None."""
    key_hash_val = hash_key(raw_key)
    row = db.query(APIKey).filter_by(key_hash=key_hash_val, is_active=True).first()
    if not row:
        return None

    # Check expiry
    if row.expires_at and row.expires_at < datetime.utcnow():
        return None

    # Update usage stats
    row.last_used_at = datetime.utcnow()
    row.request_count = (row.request_count or 0) + 1
    db.commit()

    return row


def check_scope(api_key: APIKey, required_scope: str) -> bool:
    """Check if an API key has the required scope."""
    scopes = api_key.scopes or []
    if APIKeyScope.FULL_ACCESS.value in scopes:
        return True
    return required_scope in scopes


def revoke_api_key(
    db: Session,
    key_id: UUID,
    org_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
) -> bool:
    """Deactivate an API key. Filters by org or user ownership."""
    q = db.query(APIKey).filter_by(id=key_id)
    if org_id:
        q = q.filter_by(organization_id=org_id)
    elif user_id:
        q = q.filter_by(user_id=user_id)
    else:
        return False
    row = q.first()
    if not row:
        return False
    row.is_active = False
    db.commit()
    return True


def list_api_keys(
    db: Session,
    org_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
) -> List[APIKey]:
    """List API keys filtered by org or user ownership."""
    q = db.query(APIKey)
    if org_id:
        q = q.filter_by(organization_id=org_id)
    elif user_id:
        q = q.filter_by(user_id=user_id)
    else:
        return []
    return q.order_by(APIKey.created_at.desc()).all()
