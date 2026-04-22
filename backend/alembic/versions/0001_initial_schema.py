"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-04-16

Covers phases A–D: users, posts, comments, interactions (likes/views, follows,
bookmarks, reposts), notifications, and contextual ad campaigns + events.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


# Enum type names (SQLAlchemy defaults to the lowercased class name and uses
# Python enum member .name values as labels).
# create_type=False keeps create_table from trying to recreate the type.
POST_STATUS = postgresql.ENUM(
    "DRAFT", "PUBLISHED", "ARCHIVED", name="poststatus", create_type=False
)
INTERACTION_TYPE = postgresql.ENUM(
    "LIKE", "DISLIKE", "VIEW", name="interactiontype", create_type=False
)
NOTIFICATION_TYPE = postgresql.ENUM(
    "NEW_FOLLOWER",
    "POST_LIKED",
    "POST_DISLIKED",
    "POST_COMMENTED",
    "POST_REPOSTED",
    "NEW_POST_FROM_FOLLOWED",
    name="notificationtype",
    create_type=False,
)
AD_STATUS = postgresql.ENUM(
    "DRAFT", "PENDING_REVIEW", "ACTIVE", "PAUSED", "REJECTED", "ENDED",
    name="adstatus",
    create_type=False,
)
AD_EVENT_TYPE = postgresql.ENUM(
    "IMPRESSION", "CLICK", name="adeventtype", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    POST_STATUS.create(bind, checkfirst=True)
    INTERACTION_TYPE.create(bind, checkfirst=True)
    NOTIFICATION_TYPE.create(bind, checkfirst=True)
    AD_STATUS.create(bind, checkfirst=True)
    AD_EVENT_TYPE.create(bind, checkfirst=True)

    # ---------------- users ----------------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("affiliations", sa.Text(), nullable=True),
        sa.Column("research_interests", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

    # ---------------- posts ----------------
    op.create_table(
        "posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(350), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("auto_tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("field", sa.String(100), nullable=True),
        sa.Column("sub_field", sa.String(100), nullable=True),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("status", POST_STATUS, nullable=False, server_default="DRAFT"),
        sa.Column("cover_image_url", sa.String(500), nullable=True),
        sa.Column("pdf_url", sa.String(500), nullable=True),
        sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("dislike_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("repost_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comment_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("slug", name="uq_posts_slug"),
    )
    op.create_index("ix_posts_author_id", "posts", ["author_id"])
    op.create_index("ix_posts_slug", "posts", ["slug"])
    op.create_index("ix_posts_field", "posts", ["field"])
    op.create_index("ix_posts_status", "posts", ["status"])

    # ---------------- comments ----------------
    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "post_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "parent_comment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_comments_post_id", "comments", ["post_id"])
    op.create_index("ix_comments_author_id", "comments", ["author_id"])

    # ---------------- interactions ----------------
    op.create_table(
        "interactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "post_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", INTERACTION_TYPE, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "post_id", "type", name="uq_user_post_interaction"),
    )
    op.create_index("ix_interactions_user_id", "interactions", ["user_id"])
    op.create_index("ix_interactions_post_id", "interactions", ["post_id"])

    # ---------------- follows ----------------
    op.create_table(
        "follows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("follower_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("following_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("follower_id", "following_id", name="uq_follow"),
    )
    op.create_index("ix_follows_follower_id", "follows", ["follower_id"])
    op.create_index("ix_follows_following_id", "follows", ["following_id"])

    # ---------------- bookmarks ----------------
    op.create_table(
        "bookmarks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "post_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("folder_name", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "post_id", name="uq_user_bookmark"),
    )
    op.create_index("ix_bookmarks_user_id", "bookmarks", ["user_id"])
    op.create_index("ix_bookmarks_post_id", "bookmarks", ["post_id"])

    # ---------------- reposts ----------------
    op.create_table(
        "reposts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "post_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("commentary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "post_id", name="uq_user_repost"),
    )
    op.create_index("ix_reposts_user_id", "reposts", ["user_id"])
    op.create_index("ix_reposts_post_id", "reposts", ["post_id"])

    # ---------------- notifications ----------------
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", NOTIFICATION_TYPE, nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    # ---------------- ad_campaigns ----------------
    op.create_table(
        "ad_campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "advertiser_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("advertiser_name", sa.String(200), nullable=False),
        sa.Column("headline", sa.String(140), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("cta_label", sa.String(40), nullable=False, server_default="Learn more"),
        sa.Column("link", sa.String(500), nullable=False),
        sa.Column("target_fields", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("target_keywords", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("target_languages", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("daily_budget_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_budget_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("spend_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cpm_cents", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("impressions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", AD_STATUS, nullable=False, server_default="DRAFT"),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ad_campaigns_advertiser_id", "ad_campaigns", ["advertiser_id"])
    op.create_index("ix_ad_campaigns_status", "ad_campaigns", ["status"])

    # ---------------- ad_events ----------------
    op.create_table(
        "ad_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ad_campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", AD_EVENT_TYPE, nullable=False),
        sa.Column(
            "post_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("viewer_hash", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ad_events_campaign_id", "ad_events", ["campaign_id"])
    op.create_index("ix_ad_events_type", "ad_events", ["type"])
    op.create_index("ix_ad_events_post_id", "ad_events", ["post_id"])
    op.create_index("ix_ad_events_viewer_hash", "ad_events", ["viewer_hash"])
    op.create_index("ix_ad_events_created_at", "ad_events", ["created_at"])
    op.create_index(
        "ix_ad_events_campaign_type_created",
        "ad_events",
        ["campaign_id", "type", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("ad_events")
    op.drop_table("ad_campaigns")
    op.drop_table("notifications")
    op.drop_table("reposts")
    op.drop_table("bookmarks")
    op.drop_table("follows")
    op.drop_table("interactions")
    op.drop_table("comments")
    op.drop_table("posts")
    op.drop_table("users")

    bind = op.get_bind()
    AD_EVENT_TYPE.drop(bind, checkfirst=True)
    AD_STATUS.drop(bind, checkfirst=True)
    NOTIFICATION_TYPE.drop(bind, checkfirst=True)
    INTERACTION_TYPE.drop(bind, checkfirst=True)
    POST_STATUS.drop(bind, checkfirst=True)
