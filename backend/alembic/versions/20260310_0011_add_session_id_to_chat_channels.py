"""Add session_id to chat_channels for project ↔ group sync.

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import inspect as sa_inspect


# revision identifiers
revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    insp = sa_inspect(op.get_bind())
    return column in [c["name"] for c in insp.get_columns(table)]


def _index_exists(table: str, index: str) -> bool:
    insp = sa_inspect(op.get_bind())
    return index in [i["name"] for i in insp.get_indexes(table)]


def upgrade() -> None:
    # Add session_id FK to chat_channels
    if not _column_exists("chat_channels", "session_id"):
        op.add_column(
            "chat_channels",
            sa.Column("session_id", UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            "fk_chat_channels_session_id",
            "chat_channels",
            "sessions",
            ["session_id"],
            ["id"],
            ondelete="CASCADE",
        )

    if not _index_exists("chat_channels", "idx_chat_channel_session"):
        op.create_index(
            "idx_chat_channel_session",
            "chat_channels",
            ["session_id"],
        )


def downgrade() -> None:
    op.drop_index("idx_chat_channel_session", table_name="chat_channels")
    op.drop_constraint("fk_chat_channels_session_id", "chat_channels", type_="foreignkey")
    op.drop_column("chat_channels", "session_id")
