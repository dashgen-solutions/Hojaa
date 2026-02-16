"""add ai_usage_logs table

Revision ID: 0005
Revises: 0004
Create Date: 2026-02-16

Adds:
- ai_usage_logs table for RISK-2.3C LLM budget monitoring
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_usage_logs',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('task', sa.String(100), nullable=False),
        sa.Column('model', sa.String(200), nullable=False),
        sa.Column('session_id', sa.UUID(), sa.ForeignKey('sessions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('org_id', sa.UUID(), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('prompt_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('completion_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('estimated_cost_usd', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('cache_hit', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('duration_ms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    op.create_index('idx_ai_usage_task', 'ai_usage_logs', ['task'])
    op.create_index('idx_ai_usage_model', 'ai_usage_logs', ['model'])
    op.create_index('idx_ai_usage_created_at', 'ai_usage_logs', ['created_at'])
    op.create_index('idx_ai_usage_session_id', 'ai_usage_logs', ['session_id'])
    op.create_index('idx_ai_usage_org_id', 'ai_usage_logs', ['org_id'])


def downgrade() -> None:
    op.drop_index('idx_ai_usage_org_id', table_name='ai_usage_logs')
    op.drop_index('idx_ai_usage_session_id', table_name='ai_usage_logs')
    op.drop_index('idx_ai_usage_created_at', table_name='ai_usage_logs')
    op.drop_index('idx_ai_usage_model', table_name='ai_usage_logs')
    op.drop_index('idx_ai_usage_task', table_name='ai_usage_logs')
    op.drop_table('ai_usage_logs')
