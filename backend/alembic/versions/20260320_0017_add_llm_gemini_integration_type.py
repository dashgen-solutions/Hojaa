"""Add llm_gemini to integrationtype enum

Revision ID: 0017
Revises: 0016
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL stores enum values using the Python enum member NAME (uppercase).
    op.execute("ALTER TYPE integrationtype ADD VALUE IF NOT EXISTS 'LLM_GEMINI'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    # This is intentionally a no-op for safety.
    pass
