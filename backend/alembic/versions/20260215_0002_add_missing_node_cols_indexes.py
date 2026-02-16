"""add missing node columns and indexes (REQ-7.2.1, REQ-7.4)

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-15

Adds:
- nodes.added_from_source_at (REQ-7.2.1)
- nodes.assigned_to FK to team_members (REQ-7.2.1)
- Index on sources.session_id (REQ-7.4.1)
- Index on sources.source_type
- Index on cards.session_id (REQ-7.4.5)
- Index on cards.priority
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- REQ-7.2.1: Extend Node table ---

    # added_from_source_at: tracks when a node was created from a source
    op.add_column('nodes', sa.Column(
        'added_from_source_at', sa.DateTime(), nullable=True
    ))

    # assigned_to: direct assignment shortcut to a team member
    op.add_column('nodes', sa.Column(
        'assigned_to', UUID(as_uuid=True), nullable=True
    ))
    op.create_foreign_key(
        'fk_nodes_assigned_to_team_members',
        'nodes', 'team_members',
        ['assigned_to'], ['id'],
        ondelete='SET NULL',
    )

    # --- REQ-7.4.1: Index on sources.session_id ---
    op.create_index('idx_sources_session_id', 'sources', ['session_id'])

    # --- Additional source index ---
    op.create_index('idx_sources_source_type', 'sources', ['source_type'])

    # --- REQ-7.4.5: Index on cards.session_id ---
    op.create_index('idx_cards_session_id', 'cards', ['session_id'])

    # --- Additional card index ---
    op.create_index('idx_cards_priority', 'cards', ['priority'])


def downgrade() -> None:
    op.drop_index('idx_cards_priority', table_name='cards')
    op.drop_index('idx_cards_session_id', table_name='cards')
    op.drop_index('idx_sources_source_type', table_name='sources')
    op.drop_index('idx_sources_session_id', table_name='sources')
    op.drop_constraint('fk_nodes_assigned_to_team_members', 'nodes', type_='foreignkey')
    op.drop_column('nodes', 'assigned_to')
    op.drop_column('nodes', 'added_from_source_at')
