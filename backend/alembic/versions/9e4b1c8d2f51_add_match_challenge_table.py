"""add match challenge table

Revision ID: 9e4b1c8d2f51
Revises: 7c2f4a9b1e30
Create Date: 2026-11-22 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '9e4b1c8d2f51'
down_revision: Union[str, Sequence[str], None] = '7c2f4a9b1e30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'matchchallenge',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('challenger_id', sa.Uuid(), nullable=False),
        sa.Column('challenged_id', sa.Uuid(), nullable=False),
        sa.Column('match_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('format', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('challenger_partner_id', sa.Uuid(), nullable=True),
        sa.Column('challenged_partner_id', sa.Uuid(), nullable=True),
        sa.Column('proposed_at', sa.DateTime(), nullable=False),
        sa.Column('proposed_by', sa.Uuid(), nullable=False),
        sa.Column('location', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('decline_reason', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False),
        sa.Column('reported_matches_count', sa.Integer(), nullable=False),
        sa.Column('last_match_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['challenger_id'], ['user.id']),
        sa.ForeignKeyConstraint(['challenged_id'], ['user.id']),
        sa.ForeignKeyConstraint(['challenger_partner_id'], ['user.id']),
        sa.ForeignKeyConstraint(['challenged_partner_id'], ['user.id']),
        sa.ForeignKeyConstraint(['proposed_by'], ['user.id']),
        sa.ForeignKeyConstraint(['last_match_id'], ['match.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_matchchallenge_challenger_id'), 'matchchallenge', ['challenger_id'], unique=False)
    op.create_index(op.f('ix_matchchallenge_challenged_id'), 'matchchallenge', ['challenged_id'], unique=False)
    op.create_index(op.f('ix_matchchallenge_proposed_at'), 'matchchallenge', ['proposed_at'], unique=False)
    op.create_index(op.f('ix_matchchallenge_status'), 'matchchallenge', ['status'], unique=False)
    op.create_index(op.f('ix_matchchallenge_is_public'), 'matchchallenge', ['is_public'], unique=False)
    op.create_index(op.f('ix_matchchallenge_created_at'), 'matchchallenge', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_matchchallenge_created_at'), table_name='matchchallenge')
    op.drop_index(op.f('ix_matchchallenge_is_public'), table_name='matchchallenge')
    op.drop_index(op.f('ix_matchchallenge_status'), table_name='matchchallenge')
    op.drop_index(op.f('ix_matchchallenge_proposed_at'), table_name='matchchallenge')
    op.drop_index(op.f('ix_matchchallenge_challenged_id'), table_name='matchchallenge')
    op.drop_index(op.f('ix_matchchallenge_challenger_id'), table_name='matchchallenge')
    op.drop_table('matchchallenge')
