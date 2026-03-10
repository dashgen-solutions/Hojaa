"""Add user_id column and index to ai_usage_logs for per-user usage limiting.

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import inspect as sa_inspect


# revision identifiers
revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    insp = sa_inspect(op.get_bind())
    return column in [c["name"] for c in insp.get_columns(table)]


def _index_exists(table: str, index: str) -> bool:
    insp = sa_inspect(op.get_bind())
    return index in [i["name"] for i in insp.get_indexes(table)]


def upgrade() -> None:
    if not _column_exists("ai_usage_logs", "user_id"):
        op.add_column(
            "ai_usage_logs",
            sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        )
    if not _index_exists("ai_usage_logs", "idx_ai_usage_user_id"):
        op.create_index("idx_ai_usage_user_id", "ai_usage_logs", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_ai_usage_user_id", table_name="ai_usage_logs")
    op.drop_column("ai_usage_logs", "user_id")
