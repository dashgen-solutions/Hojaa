"""Add notify_team_member_added column and fix node_history FK cascade.

Revision ID: 0007
Revises: 0006
Create Date: 2026-02-17
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add notify_team_member_added to notification_preferences
    op.add_column(
        "notification_preferences",
        sa.Column(
            "notify_team_member_added",
            sa.Boolean,
            nullable=False,
            server_default="true",
        ),
    )

    # 2. Fix node_history.node_id FK: CASCADE → SET NULL so deletion
    #    records survive when the node itself is removed.
    op.drop_constraint(
        "node_history_node_id_fkey", "node_history", type_="foreignkey"
    )
    op.alter_column(
        "node_history", "node_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.create_foreign_key(
        "node_history_node_id_fkey",
        "node_history", "nodes",
        ["node_id"], ["id"],
        ondelete="SET NULL",
    )

    # 3. Add node_title column to preserve the node name after deletion
    op.add_column(
        "node_history",
        sa.Column("node_title", sa.Text, nullable=True),
    )

    # 4. Backfill node_title from nodes for existing history records
    op.execute(
        "UPDATE node_history SET node_title = nodes.question "
        "FROM nodes WHERE node_history.node_id = nodes.id AND node_history.node_title IS NULL"
    )


def downgrade() -> None:
    op.drop_column("node_history", "node_title")

    # Revert FK back to CASCADE
    op.drop_constraint(
        "node_history_node_id_fkey", "node_history", type_="foreignkey"
    )
    op.alter_column(
        "node_history", "node_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.create_foreign_key(
        "node_history_node_id_fkey",
        "node_history", "nodes",
        ["node_id"], ["id"],
        ondelete="CASCADE",
    )

    op.drop_column("notification_preferences", "notify_team_member_added")
