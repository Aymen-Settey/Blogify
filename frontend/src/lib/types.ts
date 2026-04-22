export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  affiliations?: string | null;
  research_interests?: string[] | null;
  is_active: boolean;
  is_admin?: boolean;
  created_at: string;
}

export interface AuthorSummary {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  affiliations?: string | null;
  research_interests?: string[] | null;
  created_at: string;
  follower_count: number;
  following_count: number;
  post_count: number;
  is_following: boolean;
}

export interface Post {
  id: string;
  author_id: string;
  author: AuthorSummary;
  title: string;
  slug: string;
  content: Record<string, unknown>;
  summary?: string | null;
  tags?: string[] | null;
  auto_tags?: string[] | null;
  field?: string | null;
  sub_field?: string | null;
  language: string;
  status: "draft" | "published" | "archived";
  cover_image_url?: string | null;
  pdf_url?: string | null;
  reading_time_minutes?: number | null;
  like_count: number;
  dislike_count: number;
  repost_count: number;
  comment_count: number;
  view_count: number;
  is_bookmarked?: boolean;
  is_liked?: boolean;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  /** Optional ranking breakdown from recommendation/search endpoints (Phase 2+). */
  explanation?: Record<string, number> | null;
}

export interface PostListResponse {
  posts: Post[];
  total: number;
  page: number;
  page_size: number;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  author: AuthorSummary;
  parent_comment_id?: string | null;
  content: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  replies: Comment[];
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AdSlot {
  id: string;
  advertiser_name: string;
  headline: string;
  body: string;
  image_url?: string | null;
  cta_label: string;
  link: string;
  impression_token: string;
  score: number;
}

export type AdStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "paused"
  | "rejected"
  | "ended";

export interface AdCampaign {
  id: string;
  advertiser_id: string;
  name: string;
  advertiser_name: string;
  headline: string;
  body: string;
  image_url?: string | null;
  cta_label: string;
  link: string;
  target_fields?: string[] | null;
  target_keywords?: string[] | null;
  target_languages?: string[] | null;
  daily_budget_cents: number;
  total_budget_cents: number;
  spend_cents: number;
  cpm_cents: number;
  priority: number;
  impressions: number;
  clicks: number;
  status: AdStatus;
  rejection_reason?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdStats {
  campaign_id: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend_cents: number;
  last_7_days: { date: string; impressions: number; clicks: number }[];
}
