"""Add document_approvals table

Revision ID: 0018
Revises: 0017
Create Date: 2026-03-26
"""
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS document_approvals (
            id UUID PRIMARY KEY,
            document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            recipient_id UUID NOT NULL REFERENCES document_recipients(id) ON DELETE CASCADE,
            decision VARCHAR(20) NOT NULL,
            reason TEXT,
            decided_at TIMESTAMP NOT NULL DEFAULT now()
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_docapproval_document ON document_approvals (document_id);")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_docapproval_recipient ON document_approvals (recipient_id);")

    # Clean up the orphaned enum type from earlier failed migrations (if it exists)
    op.execute("DROP TYPE IF EXISTS approvaldecision;")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS document_approvals;")
