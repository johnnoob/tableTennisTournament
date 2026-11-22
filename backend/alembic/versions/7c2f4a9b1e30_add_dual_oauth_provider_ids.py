"""add dual oauth provider ids

Revision ID: 7c2f4a9b1e30
Revises: 316cf9b54541
Create Date: 2026-11-22 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '7c2f4a9b1e30'
down_revision: Union[str, Sequence[str], None] = '316cf9b54541'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user', sa.Column('google_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('user', sa.Column('line_user_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('user', sa.Column('line_display_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f('ix_user_google_id'), 'user', ['google_id'], unique=False)
    op.create_index(op.f('ix_user_line_user_id'), 'user', ['line_user_id'], unique=False)
    op.execute(
        'UPDATE "user" SET google_id = oauth_id '
        "WHERE auth_provider = 'google' AND oauth_id IS NOT NULL AND google_id IS NULL"
    )
    op.execute(
        'UPDATE "user" SET line_user_id = oauth_id '
        "WHERE auth_provider = 'line' AND oauth_id IS NOT NULL AND line_user_id IS NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_user_line_user_id'), table_name='user')
    op.drop_index(op.f('ix_user_google_id'), table_name='user')
    op.drop_column('user', 'line_display_name')
    op.drop_column('user', 'line_user_id')
    op.drop_column('user', 'google_id')
