"""initial baseline - capture full schema

Revision ID: 0001
Revises: None
Create Date: 2026-02-15
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Baseline migration — tables already exist via create_all().
    
    This migration is intentionally empty. It marks the baseline schema
    so future migrations can be applied incrementally.
    
    Existing tables at this baseline:
    - users, sessions, questions, nodes, conversations, messages
    - sources, source_suggestions (Phase 1)
    - node_history (Phase 2/3 audit trail)
    - team_members, cards, assignments, acceptance_criteria, card_comments (Phase 4)
    - notification_preferences
    """
    pass


def downgrade() -> None:
    pass
