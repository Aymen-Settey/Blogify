"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlogRenderer } from "@/components/BlogRenderer";
import { CommentThread } from "@/components/CommentThread";
import { SimilarPosts } from "@/components/SimilarPosts";
import { MoreFromAuthor } from "@/components/MoreFromAuthor";
import { AskPostWidget } from "@/components/AskPostWidget";
import { AdSlot } from "@/components/AdSlot";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ReadingProgress } from "@/components/ui/ReadingProgress";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Post } from "@/lib/types";
import {
  Heart,
  ThumbsDown,
  MessageCircle,
  Bookmark,
  Repeat,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

type InteractionState = {
  liked: boolean;
  disliked: boolean;
  bookmarked: boolean;
  reposted: boolean;
};

export default function PostDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const router = useRouter();
  const { user } = useAuth();
  const articleRef = useRef<HTMLElement>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [state, setState] = useState<InteractionState>({
    liked: false,
    disliked: false,
    bookmarked: false,
    reposted: false,
  });
  const [counters, setCounters] = useState({
    likes: 0,
    dislikes: 0,
    comments: 0,
    reposts: 0,
    views: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await apiFetch<Post>(`/api/posts/${slug}`);
        if (cancelled) return;
        setPost(p);
        setState((s) => ({
          ...s,
          liked: p.is_liked ?? false,
          bookmarked: p.is_bookmarked ?? false,
        }));
        setCounters({
          likes: p.like_count,
          dislikes: p.dislike_count,
          comments: p.comment_count,
          reposts: p.repost_count,
          views: p.view_count,
        });
      } catch {
        if (!cancelled) setPost(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const requireAuth = () => {
    if (!user) {
      router.push("/auth/login");
      return false;
    }
    return true;
  };

  const toggleLike = async () => {
    if (!requireAuth() || !post) return;
    // Snapshot for rollback
    const prevState = state;
    const prevCounters = counters;
    // Optimistic update
    setState((s) => ({
      ...s,
      liked: !s.liked,
      disliked: s.liked ? s.disliked : false,
    }));
    setCounters((c) => ({
      ...c,
      likes: prevState.liked ? c.likes - 1 : c.likes + 1,
      dislikes: prevState.disliked ? c.dislikes - 1 : c.dislikes,
    }));
    try {
      await apiFetch(`/api/posts/${post.id}/like`, { method: "POST" });
    } catch {
      // Rollback
      setState(prevState);
      setCounters(prevCounters);
    }
  };

  const toggleDislike = async () => {
    if (!requireAuth() || !post) return;
    const prevState = state;
    const prevCounters = counters;
    setState((s) => ({
      ...s,
      disliked: !s.disliked,
      liked: s.disliked ? s.liked : false,
    }));
    setCounters((c) => ({
      ...c,
      dislikes: prevState.disliked ? c.dislikes - 1 : c.dislikes + 1,
      likes: prevState.liked ? c.likes - 1 : c.likes,
    }));
    try {
      await apiFetch(`/api/posts/${post.id}/dislike`, { method: "POST" });
    } catch {
      setState(prevState);
      setCounters(prevCounters);
    }
  };

  const toggleBookmark = async () => {
    if (!requireAuth() || !post) return;
    const prevState = state;
    setState((s) => ({ ...s, bookmarked: !s.bookmarked }));
    try {
      await apiFetch(`/api/posts/${post.id}/bookmark`, { method: "POST" });
    } catch {
      setState(prevState);
    }
  };

  const toggleRepost = async () => {
    if (!requireAuth() || !post) return;
    const prevState = state;
    const prevCounters = counters;
    setState((s) => ({ ...s, reposted: !s.reposted }));
    setCounters((c) => ({
      ...c,
      reposts: prevState.reposted ? c.reposts - 1 : c.reposts + 1,
    }));
    try {
      await apiFetch(`/api/posts/${post.id}/repost`, { method: "POST" });
    } catch {
      setState(prevState);
      setCounters(prevCounters);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-3 bg-paper-2 rounded w-24" />
          <div className="h-12 bg-paper-2 rounded w-3/4" />
          <div className="h-4 bg-paper-2 rounded w-1/3" />
          <div className="h-64 bg-paper-2 rounded" />
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24 text-center">
        <p className="kicker mb-3">404</p>
        <h1 className="font-display text-4xl font-medium text-ink-9">
          Post not found
        </h1>
        <p className="mt-3 text-ink-6">
          The post you&apos;re looking for doesn&apos;t exist or has been
          unpublished.
        </p>
        <Link
          href="/feed"
          className="mt-6 inline-block text-brand-600 font-medium hover:text-brand-700 underline-offset-4 hover:underline"
        >
          ← Back to feed
        </Link>
      </main>
    );
  }

  const published = post.published_at
    ? new Date(post.published_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <main
      ref={articleRef}
      className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14"
    >
      <ReadingProgress targetRef={articleRef} />
      {/* Editorial header */}
      <header className="mb-10">
        {post.field && <p className="kicker mb-5">{post.field}</p>}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-medium text-ink-9 tracking-tight leading-[1.05]">
          {post.title}
        </h1>
        {post.summary && (
          <p className="mt-6 font-display text-xl text-ink-7 leading-snug italic">
            {post.summary}
          </p>
        )}

        <div className="flex items-center gap-3 mt-10 pt-6 border-t border-ink-2">
          <Link
            href={`/profile/${post.author.username}`}
            className="flex items-center gap-3 hover:opacity-80"
          >
            {post.author.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.author.avatar_url}
                alt={post.author.username}
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <div className="h-11 w-11 rounded-full bg-aurora-gradient flex items-center justify-center text-paper-0 font-display font-medium text-sm">
                {post.author.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-ink-9">
                {post.author.display_name || post.author.username}
              </div>
              <div className="text-xs text-ink-5">
                {published} · {post.reading_time_minutes ?? 1} min read
              </div>
            </div>
          </Link>
          {user && user.id === post.author_id && (
            <div className="ml-auto flex items-center gap-2">
              <Link
                href={`/post/${post.slug}/edit`}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-2 bg-paper-0 px-3 py-1.5 text-xs font-medium text-ink-7 hover:bg-paper-2 hover:text-ink-9 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-2 bg-paper-0 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 hover:border-danger/30 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Cover */}
      {post.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover_image_url}
          alt=""
          className="w-full rounded-2xl border border-ink-2 mb-12"
        />
      )}

      {/* Content with drop cap */}
      <div data-dropcap="true" className="prose-content">
        <BlogRenderer content={post.content} />
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-14 pt-8 border-t border-ink-2">
          {post.tags.map((t) => (
            <Link
              key={t}
              href={`/search?q=${encodeURIComponent(t)}`}
              className="rounded-full bg-paper-2 text-ink-6 hover:text-ink-9 hover:bg-paper-3 px-3 py-1 text-xs font-medium transition-colors"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      {/* Floating interaction bar */}
      <div className="sticky bottom-4 mt-12 mx-auto flex items-center justify-between gap-1 rounded-full border border-ink-2 bg-paper-0/95 backdrop-blur-xl px-3 py-2 shadow-editorial max-w-md">
        <IconAction
          active={state.liked}
          activeClass="bg-danger/10 text-danger"
          onClick={toggleLike}
        >
          <Heart className={state.liked ? "fill-current h-4 w-4" : "h-4 w-4"} />
          {counters.likes}
        </IconAction>
        <IconAction
          active={state.disliked}
          activeClass="bg-paper-3 text-ink-9"
          onClick={toggleDislike}
        >
          <ThumbsDown className="h-4 w-4" />
          {counters.dislikes}
        </IconAction>
        <a
          href="#comments"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-6 hover:bg-paper-2 hover:text-ink-9 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {counters.comments}
        </a>
        <IconAction
          active={state.reposted}
          activeClass="bg-success/10 text-success"
          onClick={toggleRepost}
        >
          <Repeat className="h-4 w-4" />
          {counters.reposts}
        </IconAction>
        <IconAction
          active={state.bookmarked}
          activeClass="bg-brand-50 text-brand-700"
          onClick={toggleBookmark}
        >
          <Bookmark
            className={
              state.bookmarked ? "fill-current h-4 w-4" : "h-4 w-4"
            }
          />
        </IconAction>
        <span className="hidden sm:flex items-center gap-1.5 text-sm text-ink-4 px-2">
          <Eye className="h-4 w-4" />
          {counters.views}
        </span>
      </div>

      {/* Comments */}
      <section id="comments" className="mt-16 scroll-mt-20">
        <p className="kicker mb-3">The conversation</p>
        <h2 className="font-display text-2xl font-medium text-ink-9 mb-6">
          Comments ({counters.comments})
        </h2>
        <CommentThread
          postId={post.id}
          onCountChange={(n) =>
            setCounters((c) => ({ ...c, comments: n }))
          }
        />
      </section>

      <AskPostWidget postId={post.id} />

      <SimilarPosts postId={post.id} />

      {post.author && (
        <MoreFromAuthor
          authorId={post.author.id}
          authorDisplayName={
            post.author.display_name || post.author.username
          }
          authorUsername={post.author.username}
          excludePostId={post.id}
        />
      )}

      <div className="mt-10">
        <AdSlot postId={post.id} />
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await apiFetch(`/api/posts/${post.id}`, { method: "DELETE" });
          router.push("/my-blogs");
        }}
        title={post.title}
      />
    </main>
  );
}

function IconAction({
  children,
  active,
  activeClass,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  activeClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? activeClass
          : "text-ink-6 hover:bg-paper-2 hover:text-ink-9"
      }`}
    >
      {children}
    </button>
  );
}
