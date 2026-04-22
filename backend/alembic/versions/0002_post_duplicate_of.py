"""add duplicate_of_id to posts

Revision ID: 0002_post_duplicate_of
Revises: 0001_initial_schema
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_post_duplicate_of"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column(
            "duplicate_of_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_posts_duplicate_of_id",
        "posts",
        ["duplicate_of_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_posts_duplicate_of_id", table_name="posts")
    op.drop_column("posts", "duplicate_of_id")
