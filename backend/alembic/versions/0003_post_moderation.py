"""add moderation columns to posts

Revision ID: 0003_post_moderation
Revises: 0002_post_duplicate_of
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa


revision = "0003_post_moderation"
down_revision = "0002_post_duplicate_of"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("toxicity_score", sa.Float(), nullable=True),
    )
    op.add_column(
        "posts",
        sa.Column(
            "is_flagged",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_index("ix_posts_is_flagged", "posts", ["is_flagged"])
    # Drop the server_default now that existing rows are populated.
    op.alter_column("posts", "is_flagged", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_posts_is_flagged", table_name="posts")
    op.drop_column("posts", "is_flagged")
    op.drop_column("posts", "toxicity_score")
