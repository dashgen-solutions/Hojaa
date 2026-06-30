"""Add document_signatures table for electronic signing.

Revision ID: 0019
Revises: 0018
"""
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS document_signatures (
            id UUID PRIMARY KEY,
            document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            recipient_id UUID NOT NULL REFERENCES document_recipients(id) ON DELETE CASCADE,
            signature_data TEXT NOT NULL,
            signature_type VARCHAR(20) NOT NULL DEFAULT 'draw',
            signer_name VARCHAR(255) NOT NULL,
            signer_email VARCHAR(255) NOT NULL,
            ip_address VARCHAR(45),
            signed_at TIMESTAMP NOT NULL DEFAULT now()
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_docsig_document ON document_signatures (document_id);")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_docsig_recipient ON document_signatures (recipient_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS document_signatures;")
