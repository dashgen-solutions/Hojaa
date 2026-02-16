"""add organization multi-tenancy (Enterprise)

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-15

Adds:
- OrgRole enum type
- organizations table
- users.organization_id FK, users.org_role, users.job_title
- sessions.organization_id FK
- session_members table (session-level access control)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Create OrgRole enum type ---
    org_role_enum = sa.Enum('owner', 'admin', 'member', name='orgrole')
    org_role_enum.create(op.get_bind(), checkfirst=True)

    # --- Create organizations table ---
    op.create_table(
        'organizations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(220), nullable=False, unique=True),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('industry', sa.String(100), nullable=True),
        sa.Column('size', sa.String(50), nullable=True),
        sa.Column('website', sa.String(300), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_organizations_slug', 'organizations', ['slug'], unique=True)

    # --- Add org fields to users ---
    op.add_column('users', sa.Column(
        'organization_id', UUID(as_uuid=True),
        sa.ForeignKey('organizations.id', ondelete='CASCADE'),
        nullable=True
    ))
    op.add_column('users', sa.Column(
        'org_role', org_role_enum,
        server_default='member',
        nullable=False
    ))
    op.add_column('users', sa.Column(
        'job_title', sa.String(100),
        nullable=True
    ))
    op.create_index('ix_users_organization_id', 'users', ['organization_id'])

    # --- Add org field to sessions ---
    op.add_column('sessions', sa.Column(
        'organization_id', UUID(as_uuid=True),
        sa.ForeignKey('organizations.id', ondelete='CASCADE'),
        nullable=True
    ))
    op.create_index('ix_sessions_organization_id', 'sessions', ['organization_id'])

    # --- Create session_members table ---
    op.create_table(
        'session_members',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', UUID(as_uuid=True),
                  sa.ForeignKey('sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), server_default='viewer', nullable=False),
        sa.Column('granted_by', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('granted_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('session_id', 'user_id', name='uq_session_member'),
    )
    op.create_index('ix_session_members_user_id', 'session_members', ['user_id'])
    op.create_index('ix_session_members_session_id', 'session_members', ['session_id'])


def downgrade() -> None:
    # --- Drop session_members ---
    op.drop_index('ix_session_members_session_id', table_name='session_members')
    op.drop_index('ix_session_members_user_id', table_name='session_members')
    op.drop_table('session_members')

    # --- Drop org field from sessions ---
    op.drop_index('ix_sessions_organization_id', table_name='sessions')
    op.drop_column('sessions', 'organization_id')

    # --- Drop org fields from users ---
    op.drop_index('ix_users_organization_id', table_name='users')
    op.drop_column('users', 'job_title')
    op.drop_column('users', 'org_role')
    op.drop_column('users', 'organization_id')

    # --- Drop organizations table ---
    op.drop_index('ix_organizations_slug', table_name='organizations')
    op.drop_table('organizations')

    # --- Drop OrgRole enum ---
    org_role_enum = sa.Enum('owner', 'admin', 'member', name='orgrole')
    org_role_enum.drop(op.get_bind(), checkfirst=True)
