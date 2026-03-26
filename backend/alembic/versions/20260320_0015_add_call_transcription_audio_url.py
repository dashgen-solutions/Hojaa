"""Add call_transcriptions.audio_url for stored recording files

Revision ID: 0015
Revises: 0014
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "call_transcriptions",
        sa.Column("audio_url", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("call_transcriptions", "audio_url")
