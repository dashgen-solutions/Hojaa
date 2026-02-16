"""add scope_approval_policy to organizations

Revision ID: 0004
Revises: 0003
Create Date: 2026-02-15

Adds:
- organizations.scope_approval_policy column (DEC-1.4)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'organizations',
        sa.Column('scope_approval_policy', sa.String(20), nullable=False, server_default='role_based'),
    )


def downgrade() -> None:
    op.drop_column('organizations', 'scope_approval_policy')
