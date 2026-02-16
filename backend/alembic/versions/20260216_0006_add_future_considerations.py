"""18.2 Future Considerations — add ws_presence, integrations, brand_settings, api_keys tables.

Revision ID: 0006
Revises: 0005
Create Date: 2026-02-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 18.2-A: Real-time Collaboration — WebSocket presence ──
    op.create_table(
        "ws_presence",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("connected_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("last_heartbeat", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_ws_presence_session", "ws_presence", ["session_id"])
    op.create_index("idx_ws_presence_user", "ws_presence", ["user_id"])
    op.create_index("idx_ws_presence_unique", "ws_presence", ["session_id", "user_id"], unique=True)

    # ── 18.2-B: External Integrations ──
    op.create_table(
        "integrations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("integration_type", sa.Enum("jira", "slack", name="integrationtype"), nullable=False),
        sa.Column("config", sa.JSON, server_default="{}", nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_integration_org", "integrations", ["organization_id"])
    op.create_index("idx_integration_org_type", "integrations", ["organization_id", "integration_type"], unique=True)

    op.create_table(
        "integration_syncs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("integration_id", UUID(as_uuid=True), sa.ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.String(100), nullable=True),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("external_url", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), server_default="success", nullable=False),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_sync_integration", "integration_syncs", ["integration_id"])
    op.create_index("idx_sync_created_at", "integration_syncs", ["created_at"])

    # ── 18.2-C: White-labeling / Branding ──
    op.create_table(
        "brand_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("app_name", sa.String(100), server_default="MoMetric", nullable=False),
        sa.Column("tagline", sa.String(255), nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("favicon_url", sa.String(500), nullable=True),
        sa.Column("primary_color", sa.String(7), server_default="#6366f1", nullable=False),
        sa.Column("secondary_color", sa.String(7), server_default="#8b5cf6", nullable=False),
        sa.Column("accent_color", sa.String(7), server_default="#f59e0b", nullable=False),
        sa.Column("background_color", sa.String(7), server_default="#ffffff", nullable=False),
        sa.Column("text_color", sa.String(7), server_default="#111827", nullable=False),
        sa.Column("font_family", sa.String(100), server_default="Inter, system-ui, sans-serif", nullable=False),
        sa.Column("pdf_header_text", sa.String(255), nullable=True),
        sa.Column("pdf_footer_text", sa.String(255), nullable=True),
        sa.Column("email_from_name", sa.String(100), nullable=True),
        sa.Column("custom_domain", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_brand_org", "brand_settings", ["organization_id"], unique=True)

    # ── 18.2-D: Public API — API Keys ──
    op.create_table(
        "api_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("key_prefix", sa.String(8), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("scopes", sa.JSON, server_default="[]", nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=True),
        sa.Column("last_used_at", sa.DateTime, nullable=True),
        sa.Column("request_count", sa.Integer, server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_api_key_hash", "api_keys", ["key_hash"], unique=True)
    op.create_index("idx_api_key_org", "api_keys", ["organization_id"])
    op.create_index("idx_api_key_user", "api_keys", ["user_id"])
    op.create_index("idx_api_key_prefix", "api_keys", ["key_prefix"])


def downgrade() -> None:
    op.drop_table("api_keys")
    op.drop_table("brand_settings")
    op.drop_table("integration_syncs")
    op.drop_table("integrations")
    op.drop_table("ws_presence")
    op.execute("DROP TYPE IF EXISTS integrationtype")
