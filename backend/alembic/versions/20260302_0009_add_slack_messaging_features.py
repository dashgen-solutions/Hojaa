"""Add Slack-like messaging features: reactions, threads, pins, attachments.

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import inspect as sa_inspect


# revision identifiers
revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# Helpers — make every DDL idempotent so the migration survives scenarios
# where Base.metadata.create_all() already materialised the tables.
# ---------------------------------------------------------------------------

def _table_exists(name: str) -> bool:
    insp = sa_inspect(op.get_bind())
    return name in insp.get_table_names()


def _column_exists(table: str, column: str) -> bool:
    insp = sa_inspect(op.get_bind())
    return column in [c["name"] for c in insp.get_columns(table)]


def _index_exists(table: str, index: str) -> bool:
    insp = sa_inspect(op.get_bind())
    return index in [i["name"] for i in insp.get_indexes(table)]


def _fk_exists(table: str, fk_name: str) -> bool:
    insp = sa_inspect(op.get_bind())
    return fk_name in [fk["name"] for fk in insp.get_foreign_keys(table)]


def upgrade() -> None:
    # -- Add new columns to chat_channels --
    if not _column_exists("chat_channels", "topic"):
        op.add_column("chat_channels", sa.Column("topic", sa.String(500), nullable=True))
    if not _column_exists("chat_channels", "description"):
        op.add_column("chat_channels", sa.Column("description", sa.Text, nullable=True))

    # -- Add new columns to chat_channel_messages --
    if not _column_exists("chat_channel_messages", "parent_message_id"):
        op.add_column(
            "chat_channel_messages",
            sa.Column("parent_message_id", UUID(as_uuid=True), nullable=True),
        )
    if not _column_exists("chat_channel_messages", "thread_reply_count"):
        op.add_column(
            "chat_channel_messages",
            sa.Column("thread_reply_count", sa.Integer, server_default="0", nullable=False),
        )
    if not _column_exists("chat_channel_messages", "is_pinned"):
        op.add_column(
            "chat_channel_messages",
            sa.Column("is_pinned", sa.Boolean, server_default="false", nullable=False),
        )
    if not _fk_exists("chat_channel_messages", "fk_msg_parent_message"):
        op.create_foreign_key(
            "fk_msg_parent_message",
            "chat_channel_messages",
            "chat_channel_messages",
            ["parent_message_id"],
            ["id"],
            ondelete="CASCADE",
        )
    if not _index_exists("chat_channel_messages", "idx_chat_msg_parent"):
        op.create_index("idx_chat_msg_parent", "chat_channel_messages", ["parent_message_id"])

    # -- message_reactions table --
    if not _table_exists("message_reactions"):
        op.create_table(
            "message_reactions",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "message_id",
                UUID(as_uuid=True),
                sa.ForeignKey("chat_channel_messages.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("emoji", sa.String(50), nullable=False),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )
    if not _index_exists("message_reactions", "idx_reaction_message"):
        op.create_index("idx_reaction_message", "message_reactions", ["message_id"])
    if not _index_exists("message_reactions", "idx_reaction_user_msg"):
        op.create_index("idx_reaction_user_msg", "message_reactions", ["user_id", "message_id"])
    if not _index_exists("message_reactions", "idx_reaction_unique"):
        op.create_index(
            "idx_reaction_unique",
            "message_reactions",
            ["message_id", "user_id", "emoji"],
            unique=True,
        )

    # -- message_attachments table --
    if not _table_exists("message_attachments"):
        op.create_table(
            "message_attachments",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "message_id",
                UUID(as_uuid=True),
                sa.ForeignKey("chat_channel_messages.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("file_name", sa.String(500), nullable=False),
            sa.Column("file_url", sa.Text, nullable=False),
            sa.Column("file_type", sa.String(100), nullable=True),
            sa.Column("file_size", sa.Integer, nullable=True),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )
    if not _index_exists("message_attachments", "idx_attachment_message"):
        op.create_index("idx_attachment_message", "message_attachments", ["message_id"])

    # -- pinned_messages table --
    if not _table_exists("pinned_messages"):
        op.create_table(
            "pinned_messages",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "channel_id",
                UUID(as_uuid=True),
                sa.ForeignKey("chat_channels.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "message_id",
                UUID(as_uuid=True),
                sa.ForeignKey("chat_channel_messages.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "pinned_by",
                UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        )
    if not _index_exists("pinned_messages", "idx_pinned_channel"):
        op.create_index("idx_pinned_channel", "pinned_messages", ["channel_id"])
    if not _index_exists("pinned_messages", "idx_pinned_unique"):
        op.create_index(
            "idx_pinned_unique",
            "pinned_messages",
            ["channel_id", "message_id"],
            unique=True,
        )


def downgrade() -> None:
    op.drop_table("pinned_messages")
    op.drop_table("message_attachments")
    op.drop_table("message_reactions")

    op.drop_index("idx_chat_msg_parent", table_name="chat_channel_messages")
    op.drop_constraint("fk_msg_parent_message", "chat_channel_messages", type_="foreignkey")
    op.drop_column("chat_channel_messages", "is_pinned")
    op.drop_column("chat_channel_messages", "thread_reply_count")
    op.drop_column("chat_channel_messages", "parent_message_id")

    op.drop_column("chat_channels", "description")
    op.drop_column("chat_channels", "topic")
