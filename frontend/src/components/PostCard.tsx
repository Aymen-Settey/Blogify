"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Repeat2, Bookmark, Eye } from "lucide-react";
import type { Post } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AuroraChip } from "@/components/ui/AuroraChip";
import { cn } from "@/lib/cn";

export function PostCard({ post }: { post: Post }) {
  const date = post.published_at || post.created_at;
  const { user } = useAuth();
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(post.is_bookmarked ?? false);
  const [saving, setSaving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasExplanation =
    post.explanation && Object.keys(post.explanation).length > 0;

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  /**
   * Fires when the user clicks the title or cover image. We flip a local
   * `navigating` flag so the card dims + shimmers immediately, giving instant
   * acknowledgement before Next.js mounts the destination page's loading.tsx.
   * A safety timeout clears the flag if navigation is cancelled (back button,
   * error, etc.) so the card doesn't get stuck in a skeleton state.
   */
  const handleNavigate = () => {
    setNavigating(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setNavigating(false), 4000);
  };

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (saving) return;
    const prev = bookmarked;
    setBookmarked(!prev);
    setSaving(true);
    try {
      await apiFetch(`/api/posts/${post.id}/bookmark`, { method: "POST" });
    } catch {
      setBookmarked(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      aria-busy={navigating}
      data-ai-origin={hasExplanation ? "true" : undefined}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-paper-0 p-6 transition-all duration-300 ease-editorial",
        hasExplanation ? "aurora-rail pl-[1.625rem]" : "pl-6",
        navigating
          ? "opacity-70 pointer-events-none border-brand-300 shadow-lg"
          : "border-ink-2 hover:border-ink-3 hover:-translate-y-0.5 hover:shadow-editorial",
      )}
    >
      {navigating && (
        <>
          {/* Top progress bar — indeterminate shimmer */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-2xl bg-brand-100"
          >
            <span
              className={cn(
                "block h-full w-1/3 animate-[postcard-progress_1.1s_ease-in-out_infinite]",
                hasExplanation ? "bg-aurora-gradient" : "bg-brand-500",
              )}
            />
          </span>
          {/* Whole-card shimmer sweep */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          >
            <span className="absolute inset-y-0 -left-1/2 w-1/2 animate-[postcard-shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-paper-0/60 to-transparent" />
          </span>
        </>
      )}

      {post.cover_image_url && (
        <Link
          href={`/post/${post.slug}`}
          onClick={handleNavigate}
          className="block -mx-6 -mt-6 mb-5 overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full h-52 object-cover transition-transform duration-500 ease-editorial group-hover:scale-[1.02]"
          />
        </Link>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {post.field && (
          <span className="kicker">{post.field}</span>
        )}
        {post.field ? (
          <span className="h-1 w-1 rounded-full bg-ink-3" aria-hidden />
        ) : null}
        <span className="text-xs text-ink-5">
          {new Date(date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
        {post.reading_time_minutes ? (
          <>
            <span className="h-1 w-1 rounded-full bg-ink-3" aria-hidden />
            <span className="text-xs text-ink-5">
              {post.reading_time_minutes} min read
            </span>
          </>
        ) : null}
        {hasExplanation ? (
          <AuroraChip
            className="ml-auto"
            signals={post.explanation ?? undefined}
          />
        ) : null}
      </div>

      <Link href={`/post/${post.slug}`} onClick={handleNavigate}>
        <h2 className="font-display text-2xl font-medium leading-[1.15] tracking-tight text-ink-9 group-hover:text-brand-700 transition-colors mb-2 line-clamp-2">
          {post.title}
        </h2>
      </Link>

      {post.summary && (
        <p className="text-sm text-ink-6 line-clamp-3 leading-relaxed mb-4">
          {post.summary}
        </p>
      )}

      {post.tags && post.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          {post.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-xs text-ink-6 bg-paper-2 px-2 py-0.5 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-ink-5 pt-4 border-t border-ink-2">
        <Stat icon={<Eye className="h-3.5 w-3.5" />} count={post.view_count} />
        <Stat icon={<Heart className="h-3.5 w-3.5" />} count={post.like_count} />
        <Stat
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          count={post.comment_count}
        />
        <Stat
          icon={<Repeat2 className="h-3.5 w-3.5" />}
          count={post.repost_count}
        />
        <button
          type="button"
          onClick={toggleBookmark}
          disabled={saving}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
          aria-pressed={bookmarked}
          className={cn(
            "ml-auto rounded-full p-1 transition-colors disabled:opacity-50",
            bookmarked
              ? "text-brand-600 hover:text-brand-700"
              : "text-ink-4 hover:text-brand-600",
          )}
        >
          <Bookmark
            className="h-4 w-4"
            fill={bookmarked ? "currentColor" : "none"}
          />
        </button>
      </div>
    </article>
  );
}

function Stat({ icon, count }: { icon: React.ReactNode; count: number }) {
  return (
    <div className="flex items-center gap-1">
      {icon}
      <span>{count}</span>
    </div>
  );
}
