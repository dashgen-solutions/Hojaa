"""Add roadmap, feature requests, votes, and feedback tables.

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


# ── Enum types ──────────────────────────────────────────────────

roadmap_status = sa.Enum("planned", "in_progress", "shipped", name="roadmapstatus")
roadmap_category = sa.Enum(
    "document_content", "team_communication", "project_management",
    "platform_infrastructure", "integrations",
    name="roadmapcategory",
)
feature_request_status = sa.Enum(
    "pending", "under_review", "accepted", "declined", "merged",
    name="featurerequeststatus",
)
feedback_type = sa.Enum(
    "idea", "pain_point", "praise", "bug", "other",
    name="feedbacktype",
)


def upgrade() -> None:
    # 1. Create enum types
    roadmap_status.create(op.get_bind(), checkfirst=True)
    roadmap_category.create(op.get_bind(), checkfirst=True)
    feature_request_status.create(op.get_bind(), checkfirst=True)
    feedback_type.create(op.get_bind(), checkfirst=True)

    # 2. feature_requests (created before roadmap_items because of FK)
    op.create_table(
        "feature_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("original_text", sa.Text, nullable=True),
        sa.Column("status", feature_request_status, nullable=False, server_default="pending"),
        sa.Column("admin_note", sa.Text, nullable=True),
        sa.Column("promoted_to_roadmap_id", UUID(as_uuid=True), nullable=True),
        sa.Column("vote_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_feature_req_status", "feature_requests", ["status"])
    op.create_index("idx_feature_req_user", "feature_requests", ["user_id"])
    op.create_index("idx_feature_req_votes", "feature_requests", ["vote_count"])
    op.create_index("idx_feature_req_created", "feature_requests", ["created_at"])

    # 3. roadmap_items
    op.create_table(
        "roadmap_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", roadmap_category, nullable=False),
        sa.Column("status", roadmap_status, nullable=False, server_default="planned"),
        sa.Column("is_public", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column("icon_name", sa.String(50), nullable=True),
        sa.Column("inspired_by", sa.String(255), nullable=True),
        sa.Column("feature_request_id", UUID(as_uuid=True), sa.ForeignKey("feature_requests.id", ondelete="SET NULL"), nullable=True),
        sa.Column("shipped_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_roadmap_status", "roadmap_items", ["status"])
    op.create_index("idx_roadmap_category", "roadmap_items", ["category"])
    op.create_index("idx_roadmap_public", "roadmap_items", ["is_public"])
    op.create_index("idx_roadmap_order", "roadmap_items", ["category", "order_index"])

    # 4. roadmap_votes
    op.create_table(
        "roadmap_votes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("roadmap_item_id", UUID(as_uuid=True), sa.ForeignKey("roadmap_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_roadmap_vote_unique", "roadmap_votes", ["roadmap_item_id", "user_id"], unique=True)
    op.create_index("idx_roadmap_vote_user", "roadmap_votes", ["user_id"])

    # 5. feature_request_votes
    op.create_table(
        "feature_request_votes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("feature_request_id", UUID(as_uuid=True), sa.ForeignKey("feature_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_feature_vote_unique", "feature_request_votes", ["feature_request_id", "user_id"], unique=True)
    op.create_index("idx_feature_vote_user", "feature_request_votes", ["user_id"])

    # 6. feedback
    op.create_table(
        "feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("feedback_type", feedback_type, nullable=False, server_default="idea"),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("admin_note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_feedback_type", "feedback", ["feedback_type"])
    op.create_index("idx_feedback_read", "feedback", ["is_read"])
    op.create_index("idx_feedback_created", "feedback", ["created_at"])


def downgrade() -> None:
    op.drop_table("feedback")
    op.drop_table("feature_request_votes")
    op.drop_table("roadmap_votes")
    op.drop_table("roadmap_items")
    op.drop_table("feature_requests")

    feedback_type.drop(op.get_bind(), checkfirst=True)
    feature_request_status.drop(op.get_bind(), checkfirst=True)
    roadmap_category.drop(op.get_bind(), checkfirst=True)
    roadmap_status.drop(op.get_bind(), checkfirst=True)
