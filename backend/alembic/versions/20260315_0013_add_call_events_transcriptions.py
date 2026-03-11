"""Add call event message_type and call_transcriptions table

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add message_type column to chat_channel_messages
    # Values: null (normal message), "call_started", "call_ended", "call_missed"
    op.add_column(
        'chat_channel_messages',
        sa.Column('message_type', sa.String(50), nullable=True),
    )
    op.create_index('idx_chat_msg_type', 'chat_channel_messages', ['message_type'])

    # Create call_transcriptions table
    op.create_table(
        'call_transcriptions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('channel_id', UUID(as_uuid=True), sa.ForeignKey('chat_channels.id', ondelete='CASCADE'), nullable=False),
        sa.Column('call_initiator_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('call_type', sa.String(20), nullable=False, server_default='audio'),  # audio | video
        sa.Column('duration_seconds', sa.Integer, nullable=True),
        sa.Column('transcription_text', sa.Text, nullable=True),
        sa.Column('language', sa.String(20), nullable=True),
        sa.Column('participants', sa.JSON, nullable=True),  # [{"user_id": ..., "username": ...}]
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),  # pending | completed | failed
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_call_tx_channel', 'call_transcriptions', ['channel_id'])
    op.create_index('idx_call_tx_created', 'call_transcriptions', ['created_at'])

    # Create messaging_chat_messages table for the channel-scoped chatbot
    op.create_table(
        'messaging_chat_messages',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('channel_id', UUID(as_uuid=True), sa.ForeignKey('chat_channels.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('role', sa.String(20), nullable=False),  # user | assistant
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('tool_calls', sa.JSON, nullable=True),
        sa.Column('message_metadata', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_msg_chat_channel', 'messaging_chat_messages', ['channel_id'])
    op.create_index('idx_msg_chat_user', 'messaging_chat_messages', ['user_id'])


def downgrade() -> None:
    op.drop_table('messaging_chat_messages')
    op.drop_table('call_transcriptions')
    op.drop_index('idx_chat_msg_type', table_name='chat_channel_messages')
    op.drop_column('chat_channel_messages', 'message_type')
