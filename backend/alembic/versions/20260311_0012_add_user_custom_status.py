"""Add user custom status fields

Revision ID: 20260311_0012
Revises: 20260310_0011_add_session_id_to_chat_channels
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('custom_status', sa.String(200), nullable=True))
    op.add_column('users', sa.Column('status_emoji', sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'status_emoji')
    op.drop_column('users', 'custom_status')
